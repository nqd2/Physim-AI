import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { bridgeMessageSchema, isConfigSupported } from '@physim/shared';
import type { BridgeMessage, PropertyValue, SimConfig, SimulationSchema } from '@physim/shared';
import type { HostRef } from './SimHost';

type Incoming = Extract<BridgeMessage, { type: 'READY' | 'ACK' | 'PROPERTY_CHANGED' | 'ERROR' }>;
type Outgoing = Exclude<BridgeMessage, Incoming>;
type Command = {
  [Kind in Outgoing['type']]: Omit<Extract<Outgoing, { type: Kind }>, 'version' | 'channel' | 'requestId'>;
}[Outgoing['type']];
type Snapshot = { screenId: string; values: Record<string, PropertyValue> };

function parseMessage(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (value.length > 65536) return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

function channelId() {
  return globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

export function useBridge(uri: string | undefined, simulation: SimulationSchema | undefined) {
  const host = useRef<HostRef>(null);
  const [channel, setChannel] = useState(channelId);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [screenIds, setScreenIds] = useState<string[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const latestReady = useRef(false);
  const serial = useRef(0);
  const commandActive = useRef(false);
  const pending = useRef(new Map<string, {
    resolve(snapshot: Snapshot): void;
    reject(error: Error): void;
    timer: ReturnType<typeof setTimeout>;
  }>());

  const receive = useCallback((raw: unknown) => {
    const result = bridgeMessageSchema.safeParse(parseMessage(raw));
    if (!result.success || result.data.channel !== channel) return;
    const message = result.data;
    if (message.type === 'READY') {
      if (latestReady.current) return;
      latestReady.current = true;
      setScreenIds(message.payload.screenIds);
      setReady(true);
      setFailure('');
      setSnapshot({ screenId: message.payload.screenId, values: {} });
      return;
    }
    if (!latestReady.current) return;
    if (message.type === 'PROPERTY_CHANGED') {
      setSnapshot(message.payload);
      return;
    }
    if (message.type !== 'ACK' && message.type !== 'ERROR') return;
    const request = pending.current.get(message.requestId);
    if (!request) return;
    clearTimeout(request.timer);
    pending.current.delete(message.requestId);
    if (message.type === 'ERROR') {
      request.reject(new Error(message.payload.code === 'UNSUPPORTED'
        ? 'Thao tác này chưa được hỗ trợ ở màn hình hiện tại.'
        : 'Mô phỏng chưa thực hiện được thao tác. Thử tải lại phòng thí nghiệm.'));
    } else {
      setSnapshot(message.payload);
      request.resolve(message.payload);
    }
  }, [channel]);

  const send = useCallback((command: Command): Promise<Snapshot> => {
    const activeHost = host.current;
    if (!activeHost || !latestReady.current) {
      return Promise.reject(new Error('Mô phỏng đang khởi động. Hãy thử lại khi sẵn sàng.'));
    }
    const requestId = channel + '-' + serial.current++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.current.delete(requestId);
        reject(new Error('Mô phỏng chưa phản hồi. Hãy thử lại.'));
      }, 8000);
      pending.current.set(requestId, { resolve, reject, timer });
      activeHost.send({ ...command, version: 1, channel, requestId });
    });
  }, [channel]);

  useEffect(() => {
    const requests = pending.current;
    return () => {
      latestReady.current = false;
      requests.forEach((request) => {
        clearTimeout(request.timer);
        request.reject(new Error('Mô phỏng đã được tải lại.'));
      });
      requests.clear();
    };
  }, [channel]);

  useEffect(() => {
    if (!uri || !simulation || ready) return;
    const timeout = setTimeout(() => {
      setFailure(simulation.bridgeMode === 'manual' && loaded
        ? 'Bạn có thể tương tác trực tiếp trong mô phỏng.'
        : 'Mô phỏng khởi động lâu hơn dự kiến. Bạn có thể tải lại.');
    }, loaded ? 15000 : 20000);
    return () => clearTimeout(timeout);
  }, [channel, loaded, ready, simulation, uri]);

  useEffect(() => {
    if (!ready || simulation?.bridgeMode !== 'guided') return;
    void send({ type: 'GET_STATE' }).catch((err: Error) => setFailure(err.message));
  }, [ready, send, simulation]);

  function retry() {
    latestReady.current = false;
    setReady(false);
    setLoaded(false);
    setSnapshot(undefined);
    setScreenIds([]);
    setFailure('');
    setChannel(channelId());
  }

  async function withCommand(run: () => Promise<Snapshot>): Promise<boolean> {
    if (commandActive.current) return false;
    commandActive.current = true;
    setBusy(true);
    setFailure('');
    try {
      await run();
      return true;
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Không điều khiển được mô phỏng.');
      return false;
    } finally {
      commandActive.current = false;
      setBusy(false);
    }
  }

  function configure(config: SimConfig, runExperiment: boolean) {
    if (!simulation || !isConfigSupported(simulation, config)) {
      setFailure('Cấu hình này không còn tương thích với phiên bản mô phỏng.');
      return Promise.resolve(false);
    }
    return withCommand(async () => {
      if (snapshot?.screenId !== config.screenId) await send({ type: 'SWITCH_SCREEN', payload: { screenId: config.screenId } });
      const applied = await send({ type: 'APPLY_CONFIG', payload: { screenId: config.screenId, values: config.values } });
      if (!runExperiment || !config.actionId) return applied;
      return send({ type: 'RUN_EXPERIMENT', payload: { actionId: config.actionId } });
    });
  }

  const resolvedUrl = uri ? new URL(uri) : undefined;
  resolvedUrl?.searchParams.set('physimChannel', channel);
  if (Platform.OS === 'web' && typeof window !== 'undefined') resolvedUrl?.searchParams.set('physimParent', window.location.origin);

  return {
    host, channel, ready, snapshot, screenIds, failure, busy, loaded, receive, retry, configure,
    uri: resolvedUrl?.href,
    markLoaded: () => setLoaded(true),
    markFailure: () => setFailure('Không tải được mô phỏng. Kiểm tra kết nối rồi thử lại.'),
    select: (screenId: string) => withCommand(() => send({ type: 'SWITCH_SCREEN', payload: { screenId } })),
    reset: () => withCommand(() => send({ type: 'RESET_SIM', payload: null })),
  };
}
