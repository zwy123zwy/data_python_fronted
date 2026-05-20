export type TextType = 'JSON' | 'PYTHON' | 'SQL' | 'HTML' | 'MARK_DOWN' | 'RESULT_SET' | 'TEXT';

/** [阶段0] 运行时版本：默认 v1 稳定路径 */
export type AgentRuntime = 'v1' | 'v2';

/** [阶段4] V2 强制路由模式；auto 走 Gateway */
export type AgentForceMode = 'auto' | 'smart_query' | 'deep_research' | 'report' | 'chitchat';

/** [阶段1] V2 SSE eventType（与后端 events.py 一致） */
export type AgentEventType =
  | 'agent.think'
  | 'tool.call'
  | 'tool.result'
  | 'text.delta'
  | 'agent.complete'
  | 'clarification.requested'
  | 'run.complete'
  | 'error';

export interface GraphRequest {
  agentId: number;
  threadId?: string;
  query: string;
  humanFeedback: boolean;
  humanFeedbackContent?: string;
  rejectedPlan: boolean;
  nl2sqlOnly: boolean;
  /** [阶段0] 流式运行时，默认 v1 */
  runtime?: AgentRuntime;
  /** [阶段4] V2 时可选强制 mode */
  forceMode?: AgentForceMode;
}

export interface GraphNodeResponse {
  agentId: number | string;
  threadId: string;
  nodeName: string;
  textType: TextType;
  text: string;
  /** V1: boolean; V2: error message string */
  error: boolean | string | null;
  complete: boolean;

  // V1 扩展字段
  agentName?: string;
  toolName?: string;
  toolStatus?: 'pending' | 'running' | 'done' | 'error';
  toolSummary?: string;

  // [阶段1] V2 AgentSSEEvent 字段
  runId?: string;
  eventType?: AgentEventType;
  action?: string;
  status?: 'running' | 'ok' | 'error';
  summary?: string;
  artifactRefs?: { id: string; type: string }[];
}
