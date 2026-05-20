/**
 * [阶段2] runStore — 统一 V2 Run 态（phase / thinking / plan / steps / artifacts）
 */

import { create } from 'zustand';
import type { AgentEventType } from '../types/graph';

export type RunPhase =
  | 'idle'
  | 'thinking'
  | 'planning'
  | 'executing'
  | 'delivering'
  | 'done';

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export interface ExecutionStep {
  id: string;
  toolName: string;
  agentName?: string;
  status: 'pending' | 'running' | 'done' | 'error';
  summary?: string;
}

export interface ArtifactView {
  id: string;
  type: string;
  summary?: string;
  payload?: string;
}

interface RunState {
  runId: string | null;
  phase: RunPhase;
  mode?: string;
  thinking: { text: string; collapsed: boolean };
  plan: PlanStep[];
  steps: ExecutionStep[];
  artifacts: Map<string, ArtifactView>;
  clarificationText: string | null;

  reset: () => void;
  /** [阶段5] 流式全文同步到 Workbench 思考区（每帧一次） */
  setStreamingThinking: (text: string, textType?: string) => void;
  applyV2Event: (data: {
    runId?: string;
    eventType?: AgentEventType;
    action?: string;
    agentName?: string;
    status?: string;
    summary?: string;
    text?: string;
    textType?: string;
    artifactRefs?: { id: string; type: string }[];
  }) => void;
}

const initial = {
  runId: null as string | null,
  phase: 'idle' as RunPhase,
  mode: undefined as string | undefined,
  thinking: { text: '', collapsed: false },
  plan: [] as PlanStep[],
  steps: [] as ExecutionStep[],
  artifacts: new Map<string, ArtifactView>(),
  clarificationText: null as string | null,
};

export const useRunStore = create<RunState>((set, get) => ({
  ...initial,

  reset() {
    set({ ...initial, artifacts: new Map() });
  },

  setStreamingThinking(text, textType) {
    set((s) => ({
      thinking: { ...s.thinking, text },
      phase:
        textType === 'MARK_DOWN'
          ? 'delivering'
          : s.phase === 'idle'
            ? 'thinking'
            : s.phase,
    }));
  },

  applyV2Event(data) {
    const s = get();
    const runId = data.runId ?? s.runId;
    let phase = s.phase;
    let thinking = { ...s.thinking };
    let steps = [...s.steps];
    const artifacts = new Map(s.artifacts);
    let clarificationText = s.clarificationText;

    switch (data.eventType) {
      case 'agent.think':
      case 'clarification.requested':
        // Gateway/澄清 → 主对话区 v2StatusLines，Workbench 只展示工具步骤
        break;
      case 'text.delta':
        break;
      case 'tool.call': {
        phase = 'executing';
        const toolName = data.action || 'tool';
        steps.push({
          id: `${runId}-${toolName}-${steps.length}`,
          toolName,
          agentName: data.agentName,
          status: 'running',
          summary: data.summary,
        });
        break;
      }
      case 'tool.result': {
        phase = 'executing';
        const name = data.action || '';
        const lastRunningIdx = [...steps]
          .map((st, i) => (st.toolName === name && st.status === 'running' ? i : -1))
          .filter((i) => i >= 0)
          .pop();
        if (lastRunningIdx !== undefined) {
          steps = steps.map((st, i) =>
            i === lastRunningIdx
              ? {
                  ...st,
                  status: data.status === 'error' ? 'error' : 'done',
                  summary: data.summary,
                }
              : st,
          );
        }
        if (data.textType === 'SQL' && data.text) {
          artifacts.set(`sql-${steps.length}`, {
            id: `sql-${steps.length}`,
            type: 'sql',
            payload: data.text,
          });
        }
        if (data.textType === 'RESULT_SET' && data.text) {
          artifacts.set(`table-${steps.length}`, {
            id: `table-${steps.length}`,
            type: 'table',
            payload: data.text,
          });
          phase = 'delivering';
        }
        for (const ref of data.artifactRefs || []) {
          artifacts.set(ref.id, { id: ref.id, type: ref.type });
        }
        break;
      }
      case 'agent.complete':
        phase = 'delivering';
        break;
      case 'run.complete':
        phase = 'done';
        break;
      case 'error':
        phase = 'done';
        break;
      default:
        break;
    }

    set({
      runId,
      phase,
      thinking,
      steps,
      artifacts,
      clarificationText,
    });
  },
}));
