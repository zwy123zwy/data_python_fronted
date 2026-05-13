import request from './request';
import type { ApiResponse, SemanticModel, SemanticModelAddDto, SemanticModelBatchImportDTO, BatchImportResult } from '@/types';

const BASE = '/api/semantic-model';

export const semanticModelService = {
  list(agentId: number, keyword?: string) {
    return request.get<ApiResponse<SemanticModel[]>>(BASE, { params: { agentId, keyword } });
  },

  get(id: number) {
    return request.get<ApiResponse<SemanticModel>>(`${BASE}/${id}`);
  },

  create(dto: SemanticModelAddDto & { agentId: number; datasourceId?: number }) {
    return request.post<ApiResponse<SemanticModel>>(BASE, dto);
  },

  update(id: number, dto: Partial<SemanticModelAddDto>) {
    return request.put<ApiResponse<SemanticModel>>(`${BASE}/${id}`, dto);
  },

  delete(id: number) {
    return request.delete<ApiResponse<null>>(`${BASE}/${id}`);
  },

  batchDelete(ids: number[]) {
    return request.delete<ApiResponse<null>>(`${BASE}/batch`, { data: { ids } });
  },

  enable(ids: number[]) {
    return request.put<ApiResponse<null>>(`${BASE}/enable`, { ids });
  },

  disable(ids: number[]) {
    return request.put<ApiResponse<null>>(`${BASE}/disable`, { ids });
  },

  batchImport(dto: SemanticModelBatchImportDTO) {
    return request.post<ApiResponse<BatchImportResult>>(`${BASE}/batch-import`, dto);
  },

  importExcel(formData: FormData) {
    return request.post<ApiResponse<BatchImportResult>>(`${BASE}/import/excel`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  downloadTemplate() {
    return request.get(`${BASE}/template/download`, { responseType: 'blob' });
  },
};
