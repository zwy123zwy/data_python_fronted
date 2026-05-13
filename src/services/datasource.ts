import request from './request';
import type { ApiResponse, Datasource } from '@/types';

const BASE = '/api/datasource';

export const datasourceService = {
  list(params?: Record<string, string>) {
    return request.get<ApiResponse<Datasource[]>>(BASE, { params });
  },

  get(id: number) {
    return request.get<ApiResponse<Datasource>>(`${BASE}/${id}`);
  },

  getTableList(id: number) {
    return request.get<ApiResponse<string[]>>(`${BASE}/${id}/tables`);
  },

  create(data: Partial<Datasource>) {
    return request.post<ApiResponse<Datasource>>(BASE, data);
  },

  update(id: number, data: Partial<Datasource>) {
    return request.put<ApiResponse<Datasource>>(`${BASE}/${id}`, data);
  },

  delete(id: number) {
    return request.delete<ApiResponse<null>>(`${BASE}/${id}`);
  },

  testConnection(id: number) {
    return request.post<ApiResponse<string>>(`${BASE}/${id}/test`);
  },

  getTypes() {
    return request.get<ApiResponse<{ code: string; typeName: string; dialect: string; protocol: string; displayName: string }[]>>(`${BASE}/types`);
  },
};
