export type TextType = 'JSON' | 'PYTHON' | 'SQL' | 'HTML' | 'MARK_DOWN' | 'RESULT_SET' | 'TEXT';

export interface GraphRequest {
  agentId: number;
  threadId?: string;
  query: string;
  humanFeedback: boolean;
  humanFeedbackContent?: string;
  rejectedPlan: boolean;
  nl2sqlOnly: boolean;
}

export interface GraphNodeResponse {
  agentId: string;
  threadId: string;
  nodeName: string;
  textType: TextType;
  text: string;
  error: boolean;
  complete: boolean;

  // V3.0 可选字段 (Phase 1 通过 nodeName 降级推断, Phase 2 后端直接发送)
  /** 当前执行的 Agent 名称: Explorer(探索数据) | Analyst(分析数据) | Reporter(生成报告) */
  agentName?: string;
  /** 当前调用的 Tool 名称: get_schema(获取表结构) | execute_sql(执行SQL) | text_to_sql(文本转SQL) 等 */
  toolName?: string;
  /** Tool 执行状态: pending(等待中) | running(执行中) | done(已完成) | error(执行失败) */
  toolStatus?: 'pending' | 'running' | 'done' | 'error';
  /** Tool 执行结果摘要, 单行简短描述, 长度不超过 80 字符 */
  toolSummary?: string;
}
