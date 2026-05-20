import { create } from 'zustand';

// ========== 类型定义 ==========

/** Tool 执行状态 */
export type ToolStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

/** Round (Agent 轮次) 执行状态 */
export type RoundStatus = 'pending' | 'running' | 'done' | 'partial_failure' | 'error' | 'skipped';

/** Agent 名称常量：对应后端三个执行阶段 */
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
  /** 查找或创建 round，已存在返回已有实例，不存在则新建并更新 lastAgentName */
  upsertRound: (agentName: AgentName, roundIndex: number) => AgentRound;
  /** 更新指定 agent 的 round 状态 */
  updateRoundStatus: (agentName: AgentName, status: RoundStatus) => void;
  /**
   * 向指定 agent 的 round 追加 tool 调用
   * V2.0 线性流水线：新 tool 加入时自动将同 Round 内上一 running tool 标记为 done
   */
  addToolCall: (agentName: AgentName, tool: ToolCall) => void;
  /** [阶段1] V2 tool.result：将指定 Tool 从 running 更新为 done/error */
  updateToolCallStatus: (agentName: AgentName, toolName: string, status: ToolStatus, summary?: string) => void;

  // --- 思考气泡 ---
  thinkingText: string;
  thinkingHint: string; // 副文案
  setThinking: (text: string, hint?: string) => void;
  clearThinking: () => void;

  // --- 最后操作的 agent（供 onComplete 标记最后 round 为 done） ---
  lastAgentName: AgentName | null;

  // --- 生命周期 ---
  /** 所有 running 状态 → skipped，清空思考气泡 (用户主动停止) */
  stop: () => void;
  /** SSE 错误：最后一个 running round/tool → error (与 stop 的 skipped 区分) */
  markError: () => void;
  /** 清空全部状态，恢复初始值 */
  reset: () => void;
}

/** 简单递增计数器，reset 时归零 */
let _counter = 0;
const uid = (): string => `${Date.now()}-${++_counter}-${Math.random().toString(36).slice(2, 5)}`;

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
    set((s) => ({ rounds: [...s.rounds, newRound], lastAgentName: agentName }));
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
    // 确保每个 tool 有唯一 id (调用方可传空字符串, store 兜底生成)
    const toolWithId: ToolCall = { ...tool, id: tool.id || uid() };
    set((s) => ({
      rounds: s.rounds.map((r) => {
        if (r.agentName !== agentName) return r;

        // V2.0 线性流水线：新 tool 加入时自动将上一 running tool 标记为 done
        const updatedTools = r.tools.map((t) =>
          t.status === 'running'
            ? { ...t, status: 'done' as ToolStatus, finishedAt: Date.now() }
            : t,
        );

        return { ...r, tools: [...updatedTools, toolWithId] };
      }),
      lastAgentName: agentName,
    }));
  },

  updateToolCallStatus(agentName: AgentName, toolName: string, status: ToolStatus, summary?: string) {
    set((s) => ({
      rounds: s.rounds.map((r) => {
        if (r.agentName !== agentName) return r;
        return {
          ...r,
          tools: r.tools.map((t) =>
            t.name === toolName && t.status === 'running'
              ? { ...t, status, summary: summary ?? t.summary, finishedAt: Date.now() }
              : t,
          ),
        };
      }),
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

  // --- 最后操作的 agent ---
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

  /** SSE 错误：仅标记最后一个 running round/tool 为 error (区别于 stop 的 skipped) */
  markError() {
    set((s) => {
      const rounds = [...s.rounds];
      // 从后往前找最后一个 running round
      for (let i = rounds.length - 1; i >= 0; i--) {
        const r = rounds[i];
        if (r.status === 'running') {
          const tools = r.tools.map((t, ti) => {
            // 只标记最后一个 running tool 为 error
            const isLastRunning = t.status === 'running'
              && !r.tools.slice(ti + 1).some((tt) => tt.status === 'running');
            if (isLastRunning) {
              return { ...t, status: 'error' as ToolStatus, finishedAt: Date.now() };
            }
            return t;
          });
          rounds[i] = {
            ...r,
            status: 'error' as RoundStatus,
            tools,
          };
          break; // 只处理最后一个 running round
        }
      }
      return { rounds, thinkingText: '', thinkingHint: '' };
    });
  },

  reset() {
    _counter = 0;
    set({
      rounds: [],
      thinkingText: '',
      thinkingHint: '',
      lastAgentName: null,
      drawerVisible: false,
    });
  },
}));
