import type { GraphRequest, GraphNodeResponse } from '@/types';

export type StreamCallback = (data: GraphNodeResponse) => void;
export type ErrorCallback = (error: string) => void;
export type CompleteCallback = () => void;
export type PausedCallback = (threadId: string) => void;

export interface StreamHandlers {
  onMessage: StreamCallback;
  onError?: ErrorCallback;
  onComplete?: CompleteCallback;
  onPaused?: PausedCallback;
}

export function streamSearch(
  request: GraphRequest,
  handlers: StreamHandlers,
): () => void {
  const params = new URLSearchParams();
  params.set('agentId', String(request.agentId));
  params.set('query', request.query);
  if (request.threadId) params.set('threadId', request.threadId);
  params.set('humanFeedback', String(request.humanFeedback));
  if (request.humanFeedbackContent) params.set('humanFeedbackContent', request.humanFeedbackContent);
  params.set('rejectedPlan', String(request.rejectedPlan));
  params.set('nl2sqlOnly', String(request.nl2sqlOnly));

  const url = `/api/stream/search?${params.toString()}`;
  const eventSource = new EventSource(url);

  let isCompleted = false;

  eventSource.onmessage = (event) => {
    try {
      const data: GraphNodeResponse = JSON.parse(event.data);
      handlers.onMessage(data);
    } catch (e) {
      console.error('Failed to parse SSE data:', e);
    }
  };

  // Browser-level connection error (no data)
  // 对齐 Java/Vue 版: 如果已标记完成，忽略错误（可能是正常关闭）
  eventSource.onerror = () => {
    if (isCompleted) {
      return;
    }
    console.error('EventSource error: connection failed');
    handlers.onError?.('Stream connection failed');
    eventSource.close();
  };

  // Application-level error (sent as event: error with JSON data)
  // 对齐 Java/Vue 版: 通过 event.data 区分应用层错误和浏览器错误
  eventSource.addEventListener('error', (event: Event) => {
    const m = event as MessageEvent;
    if (!m.data || isCompleted) {
      return; // 浏览器连接错误，由 onerror 处理
    }
    isCompleted = true;
    try {
      const data: GraphNodeResponse = JSON.parse(m.data);
      handlers.onError?.(data.text || 'Stream error');
    } catch {
      handlers.onError?.('Stream error');
    }
    eventSource.close();
  });

  eventSource.addEventListener('complete', () => {
    isCompleted = true;
    eventSource.close();
    handlers.onComplete?.();
  });

  eventSource.addEventListener('paused', (event: Event) => {
    isCompleted = true;
    const m = event as MessageEvent;
    try {
      const data = JSON.parse(m.data);
      const threadId = data.threadId || '';
      handlers.onPaused?.(threadId);
    } catch {
      handlers.onPaused?.('');
    }
    eventSource.close();
  });

  return () => {
    eventSource.close();
  };
}
