import request from './request';
import type { ApiResponse, PageResult, AgentKnowledge, AgentKnowledgeQueryDTO } from '@/types';

const BASE = '/api/agent-knowledge';

export const agentKnowledgeService = {
  queryPage(dto: AgentKnowledgeQueryDTO) {
    return request.post<PageResult<AgentKnowledge>>(`${BASE}/query/page`, dto);
  },

  listByAgent(agentId: number, params?: Record<string, string>) {
    return request.get<ApiResponse<AgentKnowledge[]>>(`/api/agent/${agentId}/knowledge`, { params });
  },

  get(id: number) {
    return request.get<ApiResponse<AgentKnowledge>>(`${BASE}/${id}`);
  },

  create(formData: FormData) {
    return request.post<ApiResponse<AgentKnowledge>>(`${BASE}/create`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  update(id: number, data: Partial<AgentKnowledge>) {
    return request.put<ApiResponse<AgentKnowledge>>(`${BASE}/${id}`, data);
  },

  updateRecall(id: number, isRecall: boolean) {
    return request.put<ApiResponse<null>>(`${BASE}/recall/${id}`, { isRecall });
  },

  delete(id: number) {
    return request.delete<ApiResponse<null>>(`${BASE}/${id}`);
  },

  retryEmbedding(id: number) {
    return request.post<ApiResponse<null>>(`${BASE}/retry-embedding/${id}`);
  },

  getStatistics() {
    return request.get<ApiResponse<Record<string, number>>>(`${BASE}/statistics`);
  },
};
