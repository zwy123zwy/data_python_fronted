import { create } from 'zustand';

// ========== 类型定义 ==========

/** Tool 执行状态 */
export type ToolStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

/** Round (Agent 轮次) 执行状态 */
export type RoundStatus = 'pending' | 'running' | 'done' | 'partial_failure' | 'error' | 'skipped';

/** Agent 名称常量：对应后端的三个执行阶段 */
export type AgentName = 'Explorer' | 'Analyst' | 'Reporter';

/** 单次 Tool 调用记录 */
export interface ToolCall {
  id: string;
  name: string; // get_schema | execute_sql | text_to_sql | ...
  status: ToolStatus;
  summary?: string; // 结果摘要
  startedAt?: number; // Date.now()
  finishedAt?: number;
}

/** 单个 Agent 执行轮次（一个 Round 包含多个 Tool 调用） */
export interface AgentRound {
  id: string;
  agentName: AgentName;
  roundIndex: number; // 1=Explorer, 2=Analyst, 3=Reporter
  status: RoundStatus;
  tools: ToolCall[];
}

// ========== Store ==========

interface ExecutionState {
  // --- 抽屉控制 ---
  drawerVisible: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;

  // --- Round 管理 ---
  rounds: AgentRound[];
  /** 查找或创建 round，agentName 已存在则返回已有 round，否则创建新 round 并设为 running */
  upsertRound: (agentName: AgentName, roundIndex: number) => AgentRound;
  /** 更新指定 agent 的 round 状态 */
  updateRoundStatus: (agentName: AgentName, status: RoundStatus) => void;
  /**
   * 向指定 agent 的 round 追加 tool 调用
   * V2.0 线性流水线：新 tool 加入时自动将同 Round 内上一 running tool 标记为 done
   */
  addToolCall: (agentName: AgentName, tool: ToolCall) => void;

  // --- 思考气泡 ---
  thinkingText: string;
  thinkingHint: string; // 副文案
  setThinking: (text: string, hint?: string) => void;
  clearThinking: () => void;

  // --- tool 完成追踪 (用于 onComplete 标记最后 round 完成) ---
  lastAgentName: AgentName | null;

  // --- 生命周期 ---
  /** 所有 running 状态 → skipped，清空思考气泡 */
  stop: () => void;
  /** 清空全部状态，恢复初始值 */
  reset: () => void;
}

/** 生成简单唯一 id */
const uid = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  // --- 抽屉控制 ---
  drawerVisible: false,
  openDrawer: () => set({ drawerVisible: true }),
  closeDrawer: () => set({ drawerVisible: false }),

  // --- Round 管理 ---
  rounds: [],

  upsertRound(agentName: AgentName, roundIndex: number): AgentRound {
    const existing = get().rounds.find((r) => r.agentName === agentName);
    if (existing) return existing;

    const newRound: AgentRound = {
      id: uid(),
      agentName,
      roundIndex,
      status: 'running',
      tools: [],
    };
    set((s) => ({ rounds: [...s.rounds, newRound] }));
    return newRound;
  },

  updateRoundStatus(agentName: AgentName, status: RoundStatus) {
    set((s) => ({
      rounds: s.rounds.map((r) =>
        r.agentName === agentName ? { ...r, status } : r,
      ),
    }));
  },

  addToolCall(agentName: AgentName, tool: ToolCall) {
    set((s) => ({
      rounds: s.rounds.map((r) => {
        if (r.agentName !== agentName) return r;

        // V2.0 线性流水线：新 tool 加入时自动将上一 running tool 标记为 done
        const updatedTools = r.tools.map((t) =>
          t.status === 'running'
            ? { ...t, status: 'done' as ToolStatus, finishedAt: Date.now() }
            : t,
        );

        return { ...r, tools: [...updatedTools, tool] };
      }),
      lastAgentName: agentName,
    }));
  },

  // --- 思考气泡 ---
  thinkingText: '',
  thinkingHint: '',
  setThinking(text: string, hint?: string) {
    set({ thinkingText: text, thinkingHint: hint ?? '' });
  },
  clearThinking() {
    set({ thinkingText: '', thinkingHint: '' });
  },

  // --- tool 完成追踪 ---
  lastAgentName: null,

  // --- 生命周期 ---
  stop() {
    set((s) => ({
      rounds: s.rounds.map((round) => {
        const allSkipped = round.status === 'running'
          ? { ...round, status: 'skipped' as RoundStatus }
          : round;
        const tools = allSkipped.tools.map((t) =>
          t.status === 'running'
            ? { ...t, status: 'skipped' as ToolStatus, finishedAt: Date.now() }
            : t,
        );
        return { ...allSkipped, tools };
      }),
      thinkingText: '',
      thinkingHint: '',
    }));
  },

  reset() {
    set({
      rounds: [],
      thinkingText: '',
      thinkingHint: '',
      lastAgentName: null,
      drawerVisible: false,
    });
  },
}));
