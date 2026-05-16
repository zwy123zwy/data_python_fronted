export interface PresetQuestion {
  id: number;
  agentId: number;
  question: string;
  sortOrder: number;
  isActive: boolean;
  createTime: string;
  updateTime: string;
}

export interface PresetQuestionDTO {
  question: string;
  sortOrder?: number;
  isActive?: number;
}

export interface LogicalRelation {
  id: number;
  datasourceId: number;
  sourceTableName: string;
  sourceColumnName: string;
  targetTableName: string;
  targetColumnName: string;
  relationType: '1:1' | '1:N' | 'N:1';
  description?: string;
  isDeleted: boolean;
  createdTime: string;
  updatedTime: string;
}

export interface PromptConfig {
  id: number;
  promptType: string;
  content: string;
  priority: number;
  sortOrder: number;
  enabled: boolean;
}

export interface ResultData {
  displayStyle?: ResultDisplayStyle;
  resultSet?: ResultSetData;
}

export interface ResultDisplayStyle {
  type: 'table' | 'bar' | 'column' | 'line' | 'pie';
  title?: string;
  x?: string;
  y?: string[];
}

export interface ResultSetData {
  columns: string[];
  data: Record<string, string>[];
  errorMsg?: string;
}

export interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  total: number;
}
