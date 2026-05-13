import { create } from 'zustand';
import type { GraphNodeResponse } from '@/types';

export interface SessionState {
  isStreaming: boolean;
  nodeBlocks: GraphNodeResponse[][];
  closeStream: (() => void) | null;
  lastRequest: {
    agentId: number;
    threadId: string;
    query: string;
    humanFeedback: boolean;
    humanFeedbackContent?: string;
    rejectedPlan: boolean;
    nl2sqlOnly: boolean;
  } | null;
  htmlReportContent: string | null;
  htmlReportSize: number;
  markdownReportContent: string | null;
  currentThreadId: string;
  rejectCount: number;
  showHumanFeedback: boolean;
}

interface SessionStateStore {
  states: Record<string, SessionState>;
  getState: (sessionId: string) => SessionState;
  setState: (sessionId: string, state: Partial<SessionState>) => void;
  deleteState: (sessionId: string) => void;
  getRunningSessionIds: () => string[];
}

const EMPTY_STATE: SessionState = {
  isStreaming: false,
  nodeBlocks: [],
  closeStream: null,
  lastRequest: null,
  htmlReportContent: null,
  htmlReportSize: 0,
  markdownReportContent: null,
  currentThreadId: '',
  rejectCount: 0,
  showHumanFeedback: false,
};

export const useSessionStateStore = create<SessionStateStore>((set, get) => ({
  states: {},

  getState(sessionId: string): SessionState {
    return get().states[sessionId] || { ...EMPTY_STATE };
  },

  setState(sessionId: string, state: Partial<SessionState>) {
    set((prev) => ({
      states: {
        ...prev.states,
        [sessionId]: { ...prev.getState(sessionId), ...state },
      },
    }));
  },

  deleteState(sessionId: string) {
    set((prev) => {
      const newStates = { ...prev.states };
      delete newStates[sessionId];
      return { states: newStates };
    });
  },

  getRunningSessionIds(): string[] {
    return Object.entries(get().states)
      .filter(([, s]) => s.isStreaming)
      .map(([id]) => id);
  },
}));
