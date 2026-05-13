import request from './request';
import type { ApiResponse, ChatSession, ChatMessage, CreateSessionRequest, SaveMessageRequest } from '@/types';

export const chatService = {
  getSessions(agentId: number) {
    return request.get<ApiResponse<ChatSession[]>>(`/api/agent/${agentId}/sessions`);
  },

  createSession(agentId: number, body: CreateSessionRequest) {
    return request.post<ApiResponse<ChatSession>>(`/api/agent/${agentId}/sessions`, body);
  },

  clearSessions(agentId: number) {
    return request.delete<ApiResponse<null>>(`/api/agent/${agentId}/sessions`);
  },

  getSessionMessages(sessionId: string) {
    return request.get<ApiResponse<ChatMessage[]>>(`/api/sessions/${sessionId}/messages`);
  },

  saveMessage(sessionId: string, msg: SaveMessageRequest) {
    return request.post<ApiResponse<ChatMessage>>(`/api/sessions/${sessionId}/messages`, msg);
  },

  togglePin(sessionId: string, isPinned: boolean) {
    return request.put<ApiResponse<ChatSession>>(`/api/sessions/${sessionId}/pin`, { isPinned });
  },

  renameSession(sessionId: string, title: string) {
    return request.put<ApiResponse<ChatSession>>(`/api/sessions/${sessionId}/rename`, { title });
  },

  deleteSession(sessionId: string) {
    return request.delete<ApiResponse<null>>(`/api/sessions/${sessionId}`);
  },

  downloadHtmlReport(sessionId: string) {
    return request.post(`/api/sessions/${sessionId}/reports/html`, null, {
      responseType: 'blob',
    });
  },
};
