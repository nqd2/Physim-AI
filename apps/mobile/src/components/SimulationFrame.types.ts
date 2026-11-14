import { useCallback, useEffect, useRef, useState } from 'react';
import { getRandomBytes } from 'expo-crypto';
import {
  BridgeReadyPayloadSchema,
  SimulationStateSchema,
  makeBridgeCommand,
  parseBridgeMessage,
  validateSimulationConfig,
  type BridgeCapabilities,
  type BridgeCommandType,
  type BridgeEnvelope,
  type BridgeReadyPayload,
  type SimulationState,
} from '@physim/shared';

export type FrameCommand = Exclude<BridgeCommandType, 'INIT'>;

export interface SimulationFrameHandle {
  command<T = unknown>(type: FrameCommand, payload?: unknown): Promise<T>;
  reload(): void;
}

export interface SimulationFrameProps {
  url: string;
  slug: string;
  onLoadStart?: () => void;
  onReady: (payload: BridgeReadyPayload) => void;
  onState?: (state: SimulationState) => void;
  onError?: (message: string) => void;
  height?: number;
}

export class SimulationBridgeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'SimulationBridgeError';
  }
}

export interface FrameConnection { url: string; origin: string; loadId: string }

const capabilityByCommand: Record<FrameCommand, keyof BridgeCapabilities> = {
  APPLY_CONFIG: 'applyConfig', RUN_EXPERIMENT: 'runExperiment',
  SWITCH_SCREEN: 'switchScreen', RESET_SIM: 'resetSim', GET_STATE: 'getState',
};

interface PendingCommand {
  type: FrameCommand;
  resolve: (payload: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface FrameSession {
  connection: FrameConnection;
  ready: BridgeReadyPayload | null;
  state: SimulationState | null;
  disposed: boolean;
  serial: number;
  initRequestId: string | null;
  pending: Map<string, PendingCommand>;
  send: ((envelope: BridgeEnvelope) => void) | null;
  whenReady: Promise<BridgeReadyPayload>;
  resolveReady: (value: BridgeReadyPayload) => void;
  rejectReady: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout> | null;
}

/** Both transports share correlation, validation and lifetime rules. */
export function useFrameController(props: SimulationFrameProps, platform: 'web' | 'native') {
  const callbacks = useRef(props);
  callbacks.current = props;
  const session = useRef<FrameSession | null>(null);
  const [connection, setConnection] = useState<FrameConnection | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  const dispose = useCallback((current: FrameSession, reason: Error) => {
    current.disposed = true;
    if (current.timeout) clearTimeout(current.timeout);
    current.rejectReady(reason);
    for (const request of current.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(reason);
    }
    current.pending.clear();
    current.send = null;
  }, []);

  const fail = useCallback((message: string, loadId?: string) => {
    const current = session.current;
    if (loadId && current?.connection.loadId !== loadId) return;
    if (current && !current.disposed) dispose(current, new SimulationBridgeError('LOAD_FAILED', message));
    setStatus('error');
    setError(message);
    callbacks.current.onError?.(message);
  }, [dispose]);

  useEffect(() => {
    setStatus('loading');
    setError('');
    setConnection(null);
    let current: FrameSession;
    try {
      const parsed = new URL(props.url);
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('URL mô phỏng phải là địa chỉ HTTP hoặc HTTPS hợp lệ.');
      }
      // getRandomValues works on local HTTP Web as well as HTTPS; randomUUID does not.
      const loadId = Array.from(getRandomBytes(16), value => value.toString(16).padStart(2, '0')).join('');
      parsed.searchParams.set('physimLoadId', loadId);
      if (platform === 'web') {
        parsed.searchParams.delete('physimNative');
        parsed.searchParams.set('physimParentOrigin', window.location.origin);
      } else {
        parsed.searchParams.delete('physimParentOrigin');
        parsed.searchParams.set('physimNative', '1');
      }
      let resolveReady!: (value: BridgeReadyPayload) => void;
      let rejectReady!: (reason: Error) => void;
      const whenReady = new Promise<BridgeReadyPayload>((resolve, reject) => {
        resolveReady = resolve; rejectReady = reject;
      });
      // A frame can be closed before any command awaits READY.
      void whenReady.catch(() => {});
      current = {
        connection: { url: parsed.toString(), origin: parsed.origin, loadId },
        ready: null, state: null, disposed: false, serial: 0, initRequestId: null,
        pending: new Map(), send: null, whenReady, resolveReady, rejectReady, timeout: null,
      };
      session.current = current;
      callbacks.current.onLoadStart?.();
      current.timeout = setTimeout(() => {
        fail('Mô phỏng chưa phản hồi. Kiểm tra kết nối rồi thử tải lại.', loadId);
      }, 60_000);
      setConnection(current.connection);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Không thể mở mô phỏng.';
      setStatus('error'); setError(message); callbacks.current.onError?.(message);
      return;
    }
    return () => {
      dispose(current, new SimulationBridgeError('LOAD_REPLACED', 'Lượt tải mô phỏng đã kết thúc.'));
      if (session.current === current) session.current = null;
    };
  }, [props.url, props.slug, platform, attempt, dispose, fail]);

  const reload = useCallback(() => setAttempt(value => value + 1), []);

  const loaded = useCallback((loadId: string, send: (message: BridgeEnvelope) => void) => {
    const current = session.current;
    if (!current || current.disposed || current.connection.loadId !== loadId) return;
    // A document-initiated reload/navigation also starts a fresh message lifetime.
    if (current.send) { reload(); return; }
    current.send = send;
    try {
      current.initRequestId = `init-${++current.serial}`;
      send(makeBridgeCommand('INIT', loadId, current.initRequestId));
    } catch {
      fail('Không thể kết nối với mô phỏng. Hãy thử tải lại.', loadId);
    }
  }, [fail, reload]);

  const acceptState = useCallback((current: FrameSession, value: unknown) => {
    const parsed = SimulationStateSchema.safeParse(value);
    if (!parsed.success || parsed.data.slug !== callbacks.current.slug ||
      parsed.data.version !== current.ready?.version) return false;
    current.state = parsed.data;
    callbacks.current.onState?.(parsed.data);
    return true;
  }, []);

  const receive = useCallback((input: unknown, loadId: string) => {
    const current = session.current;
    if (!current || current.disposed || current.connection.loadId !== loadId) return;
    const envelope = parseBridgeMessage(input, loadId);
    if (!envelope) return;
    if (envelope.type === 'READY') {
      const ready = BridgeReadyPayloadSchema.safeParse(envelope.payload);
      if (!ready.success || ready.data.slug !== callbacks.current.slug ||
        ready.data.schema.slug !== ready.data.slug || ready.data.schema.version !== ready.data.version) return;
      current.ready = ready.data;
      if (current.timeout) clearTimeout(current.timeout);
      current.resolveReady(ready.data);
      setStatus('ready'); setError('');
      acceptState(current, envelope.payload);
      callbacks.current.onReady(ready.data);
      return;
    }
    if (envelope.type === 'PROPERTY_CHANGED' && current.ready) {
      const payload = envelope.payload;
      if (!payload || typeof payload !== 'object') return;
      const changed = payload as { screenId?: unknown; values?: unknown };
      if (typeof changed.screenId !== 'string' || !changed.values || typeof changed.values !== 'object' || Array.isArray(changed.values)) return;
      const previous = current.state?.screenId === changed.screenId ? current.state.values : {};
      acceptState(current, {
        slug: current.ready.slug, version: current.ready.version, screenId: changed.screenId,
        values: { ...previous, ...changed.values },
      });
      return;
    }
    if (!envelope.requestId || !['RESULT', 'ERROR'].includes(envelope.type)) return;
    if (envelope.type === 'ERROR' && envelope.requestId === current.initRequestId && !current.ready) {
      const payload = envelope.payload as { message?: unknown } | null;
      fail(typeof payload?.message === 'string' ? payload.message : 'Mô phỏng chưa khởi tạo được.', loadId);
      return;
    }
    const pending = current.pending.get(envelope.requestId);
    if (!pending) return;
    current.pending.delete(envelope.requestId);
    clearTimeout(pending.timeout);
    if (envelope.type === 'ERROR') {
      const payload = envelope.payload as { code?: unknown; message?: unknown } | null;
      pending.reject(new SimulationBridgeError(
        typeof payload?.code === 'string' ? payload.code : 'BRIDGE_ERROR',
        typeof payload?.message === 'string' ? payload.message : 'Mô phỏng chưa thực hiện được thao tác.',
      ));
      return;
    }
    const payload = envelope.payload;
    const reportedState = pending.type === 'RUN_EXPERIMENT'
      ? (payload && typeof payload === 'object' && 'state' in payload ? payload.state : null)
      : payload;
    if (!acceptState(current, reportedState)) {
      pending.reject(new SimulationBridgeError('INVALID_RESPONSE', 'Số liệu mô phỏng trả về không hợp lệ.'));
      return;
    }
    pending.resolve(payload);
  }, [acceptState, fail]);

  const command = useCallback(async <T = unknown>(type: FrameCommand, payload: unknown = {}): Promise<T> => {
    const current = session.current;
    if (!current || current.disposed) throw new SimulationBridgeError('NOT_READY', 'Mô phỏng chưa sẵn sàng.');
    await current.whenReady;
    const ready = current.ready;
    if (current.disposed || session.current !== current || !current.send || !ready) throw new SimulationBridgeError('LOAD_REPLACED', 'Lượt tải mô phỏng đã thay đổi.');
    if (!ready.capabilities[capabilityByCommand[type]]) {
      throw new SimulationBridgeError('UNSUPPORTED', 'Mô phỏng này chưa hỗ trợ thao tác tự động. Bạn vẫn có thể thao tác trực tiếp.');
    }
    if (type === 'APPLY_CONFIG') {
      const checked = validateSimulationConfig(ready.schema, payload);
      if (!checked.success) throw new SimulationBridgeError('INVALID_CONFIG', checked.errors.join(' '));
    }
    if (type === 'SWITCH_SCREEN') {
      const requested = (payload as { screenId?: unknown } | null)?.screenId;
      if (!ready.schema.screens.some(screen => screen.id === requested)) throw new SimulationBridgeError('INVALID_SCREEN', 'Màn hình chưa được đăng ký.');
    }
    if (type === 'RUN_EXPERIMENT') {
      const requested = (payload as { action?: unknown } | null)?.action;
      const screen = ready.schema.screens.find(item => item.id === (current.state?.screenId ?? ready.screenId));
      if (!screen?.actions.some(action => action.id === requested)) throw new SimulationBridgeError('UNSUPPORTED', 'Thao tác chưa được đăng ký cho màn hình hiện hành.');
    }
    const requestId = `command-${++current.serial}`;
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        current.pending.delete(requestId);
        reject(new SimulationBridgeError('TIMEOUT', 'Thao tác chưa phản hồi. Hãy thử lại.'));
      }, type === 'RUN_EXPERIMENT' ? 30_000 : 12_000);
      current.pending.set(requestId, { type, timeout, resolve: value => resolve(value as T), reject });
      try {
        current.send!(makeBridgeCommand(type, current.connection.loadId, requestId, payload));
      } catch {
        clearTimeout(timeout); current.pending.delete(requestId);
        reject(new SimulationBridgeError('SEND_FAILED', 'Không gửi được thao tác tới mô phỏng.'));
      }
    });
  }, []);

  return { connection, status, error, reload, loaded, receive, fail, command };
}
