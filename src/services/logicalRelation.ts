import request from './request';
import type { ApiResponse, LogicalRelation } from '@/types';

const BASE = (datasourceId: number) => `/api/datasource/${datasourceId}/logical-relations`;

export const logicalRelationService = {
  list(datasourceId: number) {
    return request.get<ApiResponse<LogicalRelation[]>>(BASE(datasourceId));
  },

  add(datasourceId: number, relation: Partial<LogicalRelation>) {
    return request.post<ApiResponse<LogicalRelation>>(BASE(datasourceId), relation);
  },

  update(datasourceId: number, relationId: number, relation: Partial<LogicalRelation>) {
    return request.put<ApiResponse<LogicalRelation>>(`${BASE(datasourceId)}/${relationId}`, relation);
  },

  delete(datasourceId: number, relationId: number) {
    return request.delete<ApiResponse<null>>(`${BASE(datasourceId)}/${relationId}`);
  },

  batchSave(datasourceId: number, relations: Partial<LogicalRelation>[]) {
    return request.post<ApiResponse<LogicalRelation[]>>(`${BASE(datasourceId)}/batch`, relations);
  },

  getTableColumns(datasourceId: number, tableName: string) {
    return request.get<ApiResponse<string[]>>(`${BASE(datasourceId)}/columns`, { params: { tableName } });
  },
};
