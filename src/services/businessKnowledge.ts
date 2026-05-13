import request from './request';
import type { ApiResponse, BusinessKnowledgeVO, CreateBusinessKnowledgeDTO } from '@/types';

const BASE = '/api/business-knowledge';

export const businessKnowledgeService = {
  list(agentId: number, keyword?: string) {
    return request.get<ApiResponse<BusinessKnowledgeVO[]>>(BASE, { params: { agentId, keyword } });
  },

  get(id: number) {
    return request.get<ApiResponse<BusinessKnowledgeVO>>(`${BASE}/${id}`);
  },

  create(dto: CreateBusinessKnowledgeDTO) {
    return request.post<ApiResponse<BusinessKnowledgeVO>>(BASE, dto);
  },

  update(id: number, dto: Partial<CreateBusinessKnowledgeDTO>) {
    return request.put<ApiResponse<BusinessKnowledgeVO>>(`${BASE}/${id}`, dto);
  },

  delete(id: number) {
    return request.delete<ApiResponse<null>>(`${BASE}/${id}`);
  },

  toggleRecall(id: number, isRecall: boolean) {
    return request.put<ApiResponse<null>>(`${BASE}/${id}/recall`, { isRecall });
  },

  retryEmbedding(id: number) {
    return request.post<ApiResponse<null>>(`${BASE}/${id}/retry-embedding`);
  },

  refreshVectorStore(agentId: number) {
    return request.post<ApiResponse<null>>(`${BASE}/refresh-vector-store/${agentId}`);
  },
};
