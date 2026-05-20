import { create } from 'zustand';
import type { GraphNodeResponse } from '@/types';
import type { V2TimelineEntry } from '@/types/v2Timeline';

export interface SessionState {
  isStreaming: boolean;
  nodeBlocks: GraphNodeResponse[][];
  closeStream: (() => void) | null;
  lastRequest: {
    agentId: number;
    threadId?: string;
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
  /** [阶段5] LLM 流式逐字输出（主聊天气泡） */
  streamingAssistantText: string;
  streamingTextType: string;
  /** [阶段5] V2 思考时间线（主对话区，合并 Gateway + 工具步骤） */
  v2Timeline: V2TimelineEntry[];
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
  streamingAssistantText: '',
  streamingTextType: 'TEXT',
  v2Timeline: [],
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
