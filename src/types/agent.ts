export type AgentStatus = 'draft' | 'published' | 'offline';

export interface Agent {
  id: number;
  name: string;
  description: string;
  avatar?: string;
  status: AgentStatus;
  apiKey?: string | null;
  apiKeyEnabled: boolean;
  prompt?: string;
  category?: string;
  adminId?: number;
  tags?: string;
  createTime: string;
  updateTime: string;
  humanReviewEnabled?: boolean;
}

export interface AgentCreateRequest {
  name: string;
  category?: string;
  description?: string;
  prompt?: string;
  tags?: string;
  status?: AgentStatus;
  avatar?: string;
}

export interface AgentUpdateRequest extends Partial<AgentCreateRequest> {
  id: number;
}

export interface AgentApiKeyResponse {
  apiKey: string | null;
  apiKeyEnabled: boolean;
}
