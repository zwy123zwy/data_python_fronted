import request from './request';
import type { ApiResponse, Agent, AgentCreateRequest, AgentUpdateRequest, AgentApiKeyResponse } from '@/types';

const BASE = '/api/agent';

export const agentService = {
  list(params?: { status?: string; keyword?: string }) {
    return request.get<ApiResponse<Agent[]>>(`${BASE}/list`, { params });
  },

  get(id: number) {
    return request.get<ApiResponse<Agent>>(`${BASE}/${id}`);
  },

  create(data: AgentCreateRequest) {
    return request.post<ApiResponse<Agent>>(BASE, data);
  },

  update(id: number, data: AgentUpdateRequest) {
    return request.put<ApiResponse<Agent>>(`${BASE}/${id}`, data);
  },

  delete(id: number) {
    return request.delete<ApiResponse<null>>(`${BASE}/${id}`);
  },

  publish(id: number) {
    return request.post<ApiResponse<Agent>>(`${BASE}/${id}/publish`);
  },

  offline(id: number) {
    return request.post<ApiResponse<Agent>>(`${BASE}/${id}/offline`);
  },

  getApiKey(id: number) {
    return request.get<ApiResponse<AgentApiKeyResponse>>(`${BASE}/${id}/api-key`);
  },

  generateApiKey(id: number) {
    return request.post<ApiResponse<AgentApiKeyResponse>>(`${BASE}/${id}/api-key/generate`);
  },

  resetApiKey(id: number) {
    return request.post<ApiResponse<AgentApiKeyResponse>>(`${BASE}/${id}/api-key/reset`);
  },

  deleteApiKey(id: number) {
    return request.delete<ApiResponse<null>>(`${BASE}/${id}/api-key`);
  },

  enableApiKey(id: number, enabled: boolean) {
    return request.post<ApiResponse<null>>(`${BASE}/${id}/api-key/enable`, { enabled });
  },
};
