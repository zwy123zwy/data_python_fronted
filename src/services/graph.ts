import type { GraphRequest, GraphNodeResponse } from '@/types';

export type StreamCallback = (data: GraphNodeResponse) => Promise<void>;
export type ErrorCallback = (error: string) => Promise<void>;
export type CompleteCallback = () => Promise<void>;
export type PausedCallback = (threadId: string) => Promise<void>;

export interface StreamHandlers {
  onMessage: StreamCallback;
  onError?: ErrorCallback;
  onComplete?: CompleteCallback;
  onPaused?: PausedCallback;
}

const INITIAL_BACKOFF = 1000;
const MAX_BACKOFF = 30000;

interface SSELineEvent {
  event: string;
  data: string;
}

function parseSSELines(chunk: string): SSELineEvent[] {
  const events: SSELineEvent[] = [];
  const parts = chunk.split('\n\n');
  for (const part of parts) {
    if (!part.trim()) continue;
    let eventType = 'message';
    let data = '';
    const lines = part.split('\n');
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      } else if (line.startsWith('data:')) {
        data = line.slice(5);
      }
    }
    if (data) {
      events.push({ event: eventType, data });
    }
  }
  return events;
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
  // [阶段0] V2 运行时开关，默认 v1
  params.set('runtime', request.runtime ?? 'v1');
  if (request.runtime === 'v2' && request.forceMode && request.forceMode !== 'auto') {
    params.set('forceMode', request.forceMode);
  }

  const url = `/api/stream/search?${params.toString()}`;

  let abortController: AbortController | null = null;
  let stopped = false;
  let completed = false;
  let backoff = INITIAL_BACKOFF;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = async () => {
    if (stopped) return;

    abortController = new AbortController();

    try {
      const response = await fetch(url, {
        signal: abortController.signal,
        headers: { Accept: 'text/event-stream' },
      });

      if (!response.ok) {
        await handlers.onError?.(`HTTP ${response.status}: ${response.statusText}`);
        return;
      }

      if (!response.body) {
        await handlers.onError?.('浏览器不支持 ReadableStream');
        return;
      }

      backoff = INITIAL_BACKOFF; // reset on successful connection
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processEvents = async (events: SSELineEvent[]) => {
        for (const ev of events) {
          if (ev.event === 'error') {
            completed = true;
            try {
              const data: GraphNodeResponse = JSON.parse(ev.data);
              await handlers.onError?.(data.text || 'Stream error');
            } catch {
              await handlers.onError?.('Stream error');
            }
            cancelReader();
            return;
          }

          if (ev.event === 'complete') {
            completed = true;
            cancelReader();
            await handlers.onComplete?.();
            return;
          }

          if (ev.event === 'paused') {
            completed = true;
            cancelReader();
            try {
              const data = JSON.parse(ev.data);
              await handlers.onPaused?.(data.threadId || '');
            } catch {
              await handlers.onPaused?.('');
            }
            return;
          }

          // default "message" event
          try {
            const data: GraphNodeResponse = JSON.parse(ev.data);
            // [阶段1] V2 run.complete 无 event: complete 帧，需在此结束流
            if (data.complete === true || data.eventType === 'run.complete') {
              await handlers.onMessage(data);
              completed = true;
              cancelReader();
              await handlers.onComplete?.();
              return;
            }
            if (data.eventType === 'error') {
              await handlers.onMessage(data);
              completed = true;
              cancelReader();
              const errMsg =
                typeof data.error === 'string'
                  ? data.error
                  : data.summary || data.text || 'Stream error';
              await handlers.onError?.(errMsg);
              return;
            }
            await handlers.onMessage(data);
          } catch {
            await handlers.onError?.('Failed to parse server response');
            cancelReader();
            return;
          }
        }
      };

      const cancelReader = () => {
        try { reader.cancel(); } catch { /* ignore */ }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (!completed && !stopped) {
            // [阶段1] 处理 buffer 中未刷新的最后一帧
            if (buffer.trim()) {
              const tailEvents = parseSSELines(buffer + '\n\n');
              if (tailEvents.length > 0) {
                await processEvents(tailEvents);
              }
            }
            if (!completed && !stopped) {
              scheduleReconnect();
            }
          }
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const events = parseSSELines(buffer);
        // Keep the last incomplete part in buffer
        const lastDoubleNewline = buffer.lastIndexOf('\n\n');
        if (lastDoubleNewline >= 0) {
          buffer = buffer.slice(lastDoubleNewline + 2);
        }
        if (events.length > 0) {
          await processEvents(events);
          if (completed || stopped) break;
        }
      }
    } catch (err: any) {
      // AbortError is expected when we manually stop
      if (err?.name === 'AbortError') return;
      // Network error → reconnect
      if (!completed && !stopped) {
        scheduleReconnect();
      }
    }
  };

  const scheduleReconnect = () => {
    if (stopped || completed) return;
    console.warn(`SSE reconnecting in ${backoff}ms...`);
    reconnectTimer = setTimeout(() => {
      backoff = Math.min(backoff * 2, MAX_BACKOFF);
      connect();
    }, backoff);
  };

  // Start initial connect (async, fire-and-forget)
  connect();

  return () => {
    stopped = true;
    completed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (abortController) abortController.abort();
  };
}
