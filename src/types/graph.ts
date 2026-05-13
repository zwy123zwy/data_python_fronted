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
}
