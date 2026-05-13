export type ModelProvider = 'deepseek' | 'qwen' | 'openai' | 'siliconflow' | 'custom';
export type ModelType = 'CHAT' | 'EMBEDDING';

export interface ModelConfig {
  id: number;
  provider: ModelProvider;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  modelType: ModelType;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  completionsPath?: string;
  embeddingsPath?: string;
  proxyEnabled: boolean;
  proxyHost?: string;
  proxyPort?: number;
  proxyUsername?: string;
  proxyPassword?: string;
}

export interface ModelCheckReady {
  chatModelReady: boolean;
  embeddingModelReady: boolean;
  ready: boolean;
}
