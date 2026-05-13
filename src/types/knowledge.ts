export type KnowledgeType = 'DOCUMENT' | 'QA' | 'FAQ';
export type EmbeddingStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface AgentKnowledge {
  id: number;
  agentId: number;
  title: string;
  content: string;
  type: KnowledgeType;
  question?: string;
  isRecall: boolean;
  embeddingStatus: EmbeddingStatus;
  errorMsg?: string;
  createdTime: string;
  updatedTime: string;
}

export interface AgentKnowledgeQueryDTO {
  agentId: number;
  title?: string;
  type?: KnowledgeType;
  embeddingStatus?: EmbeddingStatus;
  pageNum: number;
  pageSize: number;
}

export interface BusinessKnowledgeVO {
  id: number;
  businessTerm: string;
  description: string;
  synonyms: string;
  isRecall: boolean;
  agentId: number;
  createdTime: string;
  updatedTime: string;
  embeddingStatus: EmbeddingStatus;
  errorMsg?: string;
}

export interface CreateBusinessKnowledgeDTO {
  businessTerm: string;
  description: string;
  synonyms: string;
  isRecall: boolean;
  agentId: number;
}
