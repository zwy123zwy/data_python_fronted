export interface Datasource {
  id: number;
  name: string;
  type: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  password?: string;
  connectionUrl?: string;
  status: string;
  testStatus?: string;
  description?: string;
  creatorId?: number;
  createTime: string;
  updateTime: string;
}

export interface AgentDatasource {
  id: number;
  agentId: number;
  datasourceId: number;
  isActive: boolean;
  createTime: string;
  updateTime: string;
  datasource: Datasource;
  selectTables: string[];
}

export interface DatasourceType {
  code: string;
  typeName: string;
  dialect: string;
  protocol: string;
  displayName: string;
}

export interface ToggleDatasourceDto {
  datasourceId: number;
  isActive: boolean;
}

export interface UpdateDatasourceTablesDto {
  datasourceId: number;
  tables: string[];
}
