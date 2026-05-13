import request from './request';
import type { ApiResponse, AgentDatasource, ToggleDatasourceDto, UpdateDatasourceTablesDto } from '@/types';

const BASE = (agentId: number) => `/api/agent/${agentId}/datasources`;

export const agentDatasourceService = {
  initSchema(agentId: number) {
    return request.post<ApiResponse<null>>(`${BASE(agentId)}/init`);
  },

  getByAgent(agentId: number) {
    return request.get<ApiResponse<AgentDatasource[]>>(BASE(agentId));
  },

  getActive(agentId: number) {
    return request.get<ApiResponse<AgentDatasource[]>>(`${BASE(agentId)}/active`);
  },

  addToAgent(agentId: number, datasourceId: number) {
    return request.post<ApiResponse<AgentDatasource>>(`${BASE(agentId)}/${datasourceId}`);
  },

  removeFromAgent(agentId: number, datasourceId: number) {
    return request.delete<ApiResponse<null>>(`${BASE(agentId)}/${datasourceId}`);
  },

  toggleActive(agentId: number, dto: ToggleDatasourceDto) {
    return request.put<ApiResponse<null>>(`${BASE(agentId)}/toggle`, dto);
  },

  updateSelectedTables(agentId: number, dto: UpdateDatasourceTablesDto) {
    return request.post<ApiResponse<null>>(`${BASE(agentId)}/tables`, dto);
  },
};
