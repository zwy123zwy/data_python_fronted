import { streamSearch } from '../services/graph';
import { chatService } from '../services/chat';
import { generateNodeHtml } from './nodeFormat';
import type { GraphNodeResponse, GraphRequest, ChatMessage } from '../types';
import type { SessionState } from '../stores/sessionStateStore';

interface StreamDeps {
  getState: (sid: string) => SessionState;
  setState: (sid: string, state: Partial<SessionState>) => void;
  message: { error: (msg: string) => void; success: (msg: string) => void };
  showSqlResults: boolean;
  pageSize: number;
  onScrollToBottom: () => void;
  onMessagesReloaded: (msgs: ChatMessage[]) => void;
  getSessionTitle: () => string;
}

export function sendGraphRequest(
  request: GraphRequest,
  sid: string,
  deps: StreamDeps,
): () => void {
  const { getState, setState, message, showSqlResults, pageSize, onScrollToBottom, onMessagesReloaded, getSessionTitle } = deps;

  const pendingSaves: Promise<void>[] = [];
  let currentNodeName: string | null = null;
  let currentBlockIndex = -1;

  const saveNodeBlock = (nodes: GraphNodeResponse[]): Promise<void> => {
    if (!nodes || !nodes.length) return Promise.resolve();
    const html = generateNodeHtml(nodes, showSqlResults, pageSize);
    return chatService.saveMessage(sid, {
      sessionId: sid,
      role: 'assistant',
      content: html,
      messageType: 'html',
    }).then(() => {}).catch((err) => {
      console.error('保存AI消息失败:', err);
    });
  };

  return streamSearch(request, {
    onMessage: async (data: GraphNodeResponse) => {
      if (data.error) {
        message.error(`处理错误: ${data.text}`);
        return;
      }

      const st = getState(sid);
      if (st.lastRequest) {
        st.lastRequest.threadId = data.threadId;
      }

      if (data.nodeName === 'ReportGeneratorNode') {
        const isNewNode = currentNodeName === null || data.nodeName !== currentNodeName;
        if (isNewNode) {
          if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
            pendingSaves.push(saveNodeBlock(st.nodeBlocks[currentBlockIndex]));
          }
          st.nodeBlocks.push([{ ...data }]);
          currentBlockIndex = st.nodeBlocks.length - 1;
          currentNodeName = data.nodeName;
        }

        if (data.textType === 'HTML') {
          st.htmlReportContent = (st.htmlReportContent || '') + data.text;
          st.htmlReportSize = st.htmlReportContent.length;
          const reportBlock = st.nodeBlocks.find(
            (b) => b.length > 0 && b[0].nodeName === 'ReportGeneratorNode' && b[0].textType === 'HTML',
          );
          if (reportBlock) {
            reportBlock[0].text = `正在收集HTML报告... 已收集 ${st.htmlReportSize} 字节`;
          }
        } else if (data.textType === 'MARK_DOWN') {
          st.markdownReportContent = (st.markdownReportContent || '') + data.text;
          const reportBlock = st.nodeBlocks.find(
            (b) => b.length > 0 && b[0].nodeName === 'ReportGeneratorNode' && b[0].textType === 'MARK_DOWN',
          );
          if (reportBlock) {
            reportBlock[0].text = `正在收集Markdown报告... 已收集 ${st.markdownReportContent.length} 字节`;
          } else {
            st.nodeBlocks.push([{
              ...data,
              text: `正在收集Markdown报告... 已收集 ${st.markdownReportContent.length} 字节`,
            }]);
          }
        }

        setState(sid, { nodeBlocks: [...st.nodeBlocks], htmlReportContent: st.htmlReportContent, htmlReportSize: st.htmlReportSize, markdownReportContent: st.markdownReportContent });
      } else if (data.textType === 'RESULT_SET') {
        if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
          pendingSaves.push(saveNodeBlock(st.nodeBlocks[currentBlockIndex]));
        }
        st.nodeBlocks.push([{ ...data }]);
        currentBlockIndex = st.nodeBlocks.length - 1;
        currentNodeName = 'result_set';
        setState(sid, { nodeBlocks: [...st.nodeBlocks] });
      } else {
        const isNewNode = currentNodeName === null || data.nodeName !== currentNodeName;
        if (isNewNode) {
          if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
            pendingSaves.push(saveNodeBlock(st.nodeBlocks[currentBlockIndex]));
          }
          st.nodeBlocks.push([{ ...data }]);
          currentBlockIndex = st.nodeBlocks.length - 1;
          currentNodeName = data.nodeName;
        } else {
          if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
            st.nodeBlocks[currentBlockIndex].push({ ...data });
          } else {
            st.nodeBlocks.push([{ ...data }]);
            currentBlockIndex = st.nodeBlocks.length - 1;
            currentNodeName = data.nodeName;
          }
        }
        setState(sid, { nodeBlocks: [...st.nodeBlocks] });
      }

      onScrollToBottom();
    },

    onError: async (error: string) => {
      message.error(`流式请求失败: ${error}`);
      if (pendingSaves.length > 0) await Promise.all(pendingSaves);
      setState(sid, { isStreaming: false, closeStream: null });
      try {
        const res = await chatService.getSessionMessages(sid);
        onMessagesReloaded((res.data.data || []) as ChatMessage[]);
      } catch { /* ignore */ }
    },

    onComplete: async () => {
      if (pendingSaves.length > 0) await Promise.all(pendingSaves);

      const st = getState(sid);

      if (st.htmlReportContent) {
        await chatService.saveMessage(sid, {
          sessionId: sid, role: 'assistant', content: st.htmlReportContent, messageType: 'html-report',
        }).then((res) => {
          const saved = res.data.data as ChatMessage;
          if (saved) onMessagesReloaded([saved]);
        }).catch(() => {});
        setState(sid, { isStreaming: false, nodeBlocks: [] });
      } else if (st.markdownReportContent) {
        await chatService.saveMessage(sid, {
          sessionId: sid, role: 'assistant', content: st.markdownReportContent, messageType: 'markdown-report',
        }).then((res) => {
          const saved = res.data.data as ChatMessage;
          if (saved) onMessagesReloaded([saved]);
        }).catch(() => {});
        setState(sid, { isStreaming: false, nodeBlocks: [] });
      } else {
        if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
          await saveNodeBlock(st.nodeBlocks[currentBlockIndex]);
        }
        setState(sid, { isStreaming: false });
      }

      message.success(`会话[${getSessionTitle()}]处理完成`);

      try {
        const res = await chatService.getSessionMessages(sid);
        onMessagesReloaded((res.data.data || []) as ChatMessage[]);
      } catch { /* ignore */ }
    },

    onPaused: async (threadId: string) => {
      const st = getState(sid);
      if (st.lastRequest) {
        st.lastRequest.threadId = threadId || st.lastRequest.threadId;
      }
      if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
        await saveNodeBlock(st.nodeBlocks[currentBlockIndex]);
      }
      if (pendingSaves.length > 0) await Promise.all(pendingSaves);
      setState(sid, {
        isStreaming: false,
        nodeBlocks: [],
        showHumanFeedback: true,
        lastRequest: st.lastRequest,
      });
    },
  });
}
