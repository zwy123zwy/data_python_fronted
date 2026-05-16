import request from './request';
import type { ApiResponse, PresetQuestion, PresetQuestionDTO } from '@/types';

const BASE = (agentId: number) => `/api/agent/${agentId}/preset-questions`;

export const presetQuestionService = {
  list(agentId: number) {
    return request.get<ApiResponse<PresetQuestion[]>>(BASE(agentId));
  },

  batchSave(agentId: number, questions: PresetQuestionDTO[]) {
    return request.post<ApiResponse<PresetQuestion[]>>(BASE(agentId), { questions });
  },

  delete(agentId: number, questionId: number) {
    return request.delete<ApiResponse<null>>(`${BASE(agentId)}/${questionId}`);
  },
};
