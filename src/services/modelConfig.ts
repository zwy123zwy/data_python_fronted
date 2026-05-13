import request from './request';
import type { ApiResponse, ModelConfig, ModelCheckReady } from '@/types';

const BASE = '/api/model-config';

export const modelConfigService = {
  list() {
    return request.get<ApiResponse<ModelConfig[]>>(`${BASE}/list`);
  },

  add(config: Partial<ModelConfig>) {
    return request.post<ApiResponse<ModelConfig>>(`${BASE}/add`, config);
  },

  update(config: Partial<ModelConfig> & { id: number }) {
    return request.put<ApiResponse<ModelConfig>>(`${BASE}/update`, config);
  },

  delete(id: number) {
    return request.delete<ApiResponse<null>>(`${BASE}/${id}`);
  },

  activate(id: number) {
    return request.post<ApiResponse<null>>(`${BASE}/activate/${id}`);
  },

  test(config: Partial<ModelConfig>) {
    return request.post<ApiResponse<string>>(`${BASE}/test`, config);
  },

  checkReady() {
    return request.get<ApiResponse<ModelCheckReady>>(`${BASE}/check-ready`);
  },
};
