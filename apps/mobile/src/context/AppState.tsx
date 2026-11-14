import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { reviewSM2 } from '@physim/shared';
import {
  createDeviceStore, defaultServerUrl, initialDeviceState, normalizeServerUrl, validateCard, validateSession,
  type AppSettings, type DeviceState, type LearningSession, type ReviewCard,
} from '../lib/storage';

export type { LearningSession, ReviewCard, AppSettings } from '../lib/storage';

type SessionUpdate = Partial<LearningSession> | ((current: LearningSession) => LearningSession);
interface SaveSession {
  (session: LearningSession): void;
  (id: string, update: SessionUpdate): void;
}

export interface AppStateValue {
  settings: AppSettings;
  setServerUrl: (url: string) => void;
  setReduceMotion: (enabled: boolean) => void;
  sessions: Record<string, LearningSession>;
  saveSession: SaveSession;
  cards: ReviewCard[];
  saveCard: (card: ReviewCard) => Promise<void>;
  reviewCard: (id: string, quality: number) => void;
  hydrated: boolean;
  storageError: string | null;
}

const AppStateContext = createContext<AppStateValue | null>(null);
type Update = (previous: DeviceState) => DeviceState;

function makeInitialState(): DeviceState {
  const browser = typeof window !== 'undefined' && window.location ? window.location : undefined;
  return initialDeviceState(defaultServerUrl(Constants.expoConfig?.hostUri, browser));
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DeviceState>(makeInitialState);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const stateRef = useRef(state);
  const ready = useRef(false);
  const pending = useRef<Update[]>([]);
  const mounted = useRef(true);
  const store = useMemo(() => createDeviceStore(AsyncStorage), []);
  const write = useCallback((next: DeviceState) => {
    const operation = store.write(next);
    void operation.then(() => {
      if (mounted.current) setStorageError(null);
    }, () => {
      if (mounted.current) setStorageError('Không lưu được tiến độ trên thiết bị. Kiểm tra dung lượng và quyền lưu trữ.');
    });
    return operation;
  }, [store]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    const fallback = stateRef.current;
    void store.read(fallback).then(({ state: saved, recovered }) => {
      if (!active) return;
      const buffered = pending.current;
      pending.current = [];
      const next = buffered.reduce((current, update) => update(current), saved);
      stateRef.current = next;
      ready.current = true;
      setState(next);
      setHydrated(true);
      if (recovered) setStorageError('Một phần tiến độ cục bộ không đọc được. Các phiên và thẻ hợp lệ vẫn được giữ.');
      // Reading alone never overwrites previously saved data.
      if (buffered.length) write(next);
    }).catch(() => {
      if (!active) return;
      pending.current = [];
      ready.current = true;
      setHydrated(true);
      setStorageError('Không đọc được tiến độ trên thiết bị. Các thay đổi mới sẽ được thử lưu khi bạn tiếp tục học.');
    });
    return () => { active = false; mounted.current = false; };
  }, [store, write]);

  const commit = useCallback((update: Update) => {
    const next = update(stateRef.current);
    stateRef.current = next;
    setState(next);
    if (ready.current) return write(next);
    pending.current.push(update);
    return Promise.resolve();
  }, [write]);

  const setServerUrl = useCallback((url: string) => {
    const serverUrl = normalizeServerUrl(url);
    commit(previous => ({ ...previous, settings: { ...previous.settings, serverUrl } }));
  }, [commit]);

  const setReduceMotion = useCallback((reduceMotion: boolean) => {
    commit(previous => ({ ...previous, settings: { ...previous.settings, reduceMotion } }));
  }, [commit]);

  const saveSession: SaveSession = useCallback((sessionOrId: LearningSession | string, update?: SessionUpdate) => {
    commit(previous => {
      let candidate: LearningSession;
      if (typeof sessionOrId === 'string') {
        const current = Object.hasOwn(previous.sessions, sessionOrId) ? previous.sessions[sessionOrId] : undefined;
        if (!current) throw new Error('Không tìm thấy phiên học để cập nhật.');
        candidate = typeof update === 'function' ? update(current) : { ...current, ...update };
        candidate = { ...candidate, id: current.id, createdAt: current.createdAt };
      } else candidate = sessionOrId;
      const session = validateSession({ ...candidate, updatedAt: new Date().toISOString() });
      const sessions = Object.assign(Object.create(null), previous.sessions, { [session.id]: session }) as Record<string, LearningSession>;
      return { ...previous, sessions };
    });
  }, [commit]);

  const saveCard = useCallback(async (candidate: ReviewCard) => {
    if (!ready.current) throw new Error('Tiến độ đang được tải. Vui lòng thử lưu thẻ sau một chút.');
    const card = validateCard(candidate);
    await commit(previous => {
      const index = previous.cards.findIndex(item => item.id === card.id);
      const cards = [...previous.cards];
      if (index >= 0) cards[index] = card;
      else cards.unshift(card);
      return { ...previous, cards };
    });
  }, [commit]);

  const reviewCard = useCallback((id: string, quality: number) => {
    commit(previous => {
      if (!previous.cards.some(card => card.id === id)) throw new Error('Không tìm thấy thẻ ôn tập.');
      return { ...previous, cards: previous.cards.map(card => card.id === id ? reviewSM2(card, quality, new Date().toISOString()) : card) };
    });
  }, [commit]);

  const value = useMemo<AppStateValue>(() => ({
    settings: state.settings, setServerUrl, setReduceMotion,
    sessions: state.sessions, saveSession,
    cards: state.cards, saveCard, reviewCard,
    hydrated, storageError,
  }), [state, setServerUrl, setReduceMotion, saveSession, saveCard, reviewCard, hydrated, storageError]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState phải nằm trong AppStateProvider.');
  return value;
}
