import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Analysis, SimConfig, TeachBackAssessment, Variant, WorkDiagnosis } from '@physim/shared';
import { initialServer } from './api';
import { scheduleReview } from './sm2';
import type { ReviewGrade, ReviewSchedule } from './sm2';

export interface Session {
  id: string;
  title: string;
  slug?: string;
  sampleId?: string;
  analysis?: Analysis;
  activeStep: number;
  prediction?: number;
  observed?: boolean;
  hintCount?: number;
  diagnosis?: WorkDiagnosis;
  orderedChain?: string[];
  explanation?: string;
  assessment?: TeachBackAssessment;
  variant?: Variant;
  variantPrediction?: string;
  variantObserved?: boolean;
  lastConfig?: SimConfig;
  lastVersion?: string;
}

export interface ReviewCard extends ReviewSchedule {
  id: string;
  title: string;
  prompt: string;
  answer: string;
  sessionId: string;
  config?: SimConfig;
  simulationVersion?: string;
}

interface StoreData {
  version: 1;
  server: string;
  sessions: Record<string, Session>;
  cards: Record<string, ReviewCard>;
}

const key = 'physim.pilot.v1';
const initial: StoreData = { version: 1, server: initialServer, sessions: {}, cards: {} };

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 11);
}

function useAppData() {
  const [data, setData] = useState(initial);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState('');
  const current = useRef(initial);
  const pending = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key).then((raw) => {
      if (!raw || !active) return;
      const parsed = JSON.parse(raw) as StoreData;
      if (parsed.version !== 1 || !parsed.sessions || !parsed.cards || typeof parsed.server !== 'string') {
        throw new Error('Dữ liệu lưu không đúng định dạng.');
      }
      current.current = parsed;
      setData(parsed);
    }).catch(() => {
      if (active) setStorageError('Không đọc được tiến độ đã lưu trên thiết bị.');
    }).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  const write = (change: (previous: StoreData) => StoreData) => {
    const next = change(current.current);
    current.current = next;
    setData(next);
    pending.current = pending.current.then(async () => {
      try {
        await AsyncStorage.setItem(key, JSON.stringify(next));
        setStorageError('');
      } catch {
        setStorageError('Không lưu được tiến độ trên thiết bị. Hãy kiểm tra dung lượng lưu trữ.');
      }
    });
  };

  return {
    ...data,
    hydrated,
    storageError,
    setServer: (server: string) => write((previous) => ({ ...previous, server })),
    createSession: (input: Omit<Session, 'id' | 'activeStep'>) => {
      const id = newId();
      write((previous) => ({
        ...previous,
        sessions: { ...previous.sessions, [id]: { ...input, id, activeStep: 0 } },
      }));
      return id;
    },
    patchSession: (id: string, change: Partial<Omit<Session, 'id'>>) => {
      write((previous) => {
        const session = previous.sessions[id];
        if (!session) return previous;
        return { ...previous, sessions: { ...previous.sessions, [id]: { ...session, ...change } } };
      });
    },
    saveCard: (input: Pick<ReviewCard, 'sessionId' | 'title' | 'prompt' | 'answer' | 'config' | 'simulationVersion'>) => {
      const id = input.sessionId;
      write((previous) => {
        if (previous.cards[id]) return previous;
        const card: ReviewCard = { ...input, id, repetitions: 0, intervalDays: 0, ease: 2.5, dueAt: Date.now() };
        return { ...previous, cards: { ...previous.cards, [id]: card } };
      });
    },
    gradeCard: (id: string, grade: ReviewGrade) => {
      write((previous) => {
        const card = previous.cards[id];
        if (!card) return previous;
        const updated = { ...card, ...scheduleReview(card, grade, Date.now()) };
        return { ...previous, cards: { ...previous.cards, [id]: updated } };
      });
    },
  };
}

const StoreContext = createContext<ReturnType<typeof useAppData> | null>(null);

export function AppStore({ children }: { children: ReactNode }) {
  const store = useAppData();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('AppStore chưa sẵn sàng.');
  return store;
}
