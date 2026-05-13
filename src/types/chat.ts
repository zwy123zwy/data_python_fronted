export type MessageRole = 'user' | 'assistant' | 'system';

export type MessageType =
  | 'text'
  | 'sql'
  | 'result'
  | 'error'
  | 'html'
  | 'html-report'
  | 'markdown-report'
  | 'result-set';

export interface ChatSession {
  id: string;
  agentId: number;
  title: string;
  status?: string;
  isPinned: boolean;
  userId: string;
  createTime: string;
  updateTime: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  messageType: MessageType;
  metadata?: Record<string, unknown>;
  createTime: string;
  titleNeeded?: boolean;
}

export interface CreateSessionRequest {
  title: string;
  userId: string;
}

export interface SaveMessageRequest {
  sessionId: string;
  role: MessageRole;
  content: string;
  messageType: MessageType;
  metadata?: Record<string, unknown>;
  titleNeeded?: boolean;
}
