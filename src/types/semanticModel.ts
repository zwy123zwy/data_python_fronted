export interface SemanticModel {
  id: number;
  agentId: number;
  datasourceId: number;
  tableName: string;
  columnName: string;
  businessName?: string;
  synonyms?: string;
  businessDescription?: string;
  columnComment?: string;
  dataType?: string;
  status: 'enabled' | 'disabled';
  createdTime: string;
  updateTime: string;
}

export interface SemanticModelAddDto {
  tableName: string;
  columnName: string;
  businessName?: string;
  synonyms?: string;
  businessDescription?: string;
  columnComment?: string;
  dataType?: string;
}

export interface SemanticModelImportItem {
  tableName: string;
  columnName: string;
  businessName?: string;
  synonyms?: string;
  businessDescription?: string;
}

export interface SemanticModelBatchImportDTO {
  agentId: number;
  datasourceId?: number;
  items: SemanticModelImportItem[];
}

export interface BatchImportResult {
  successCount: number;
  failCount: number;
  errors: string[];
}
