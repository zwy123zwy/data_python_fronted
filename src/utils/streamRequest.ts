import { streamSearch } from '../services/graph';
import { chatService } from '../services/chat';
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

/**
 * sendGraphRequest — 发起 SSE 流式请求，将后端图节点输出分组写入 Zustand store
 *
 * 核心设计：
 * - 中间节点块仅在内存中累积为思维链展示，不持久化到后端
 * - onComplete：清除 nodeBlocks，思维链消失；只保存最终报告，重新加载消息呈现干净结果
 * - onError / onStop：保留 nodeBlocks，思维链以"思考完成"状态展示部分进展
 * - 下次发送时 doStreamRequest 清空 nodeBlocks，开始新一轮思维链
 */
export function sendGraphRequest(
  request: GraphRequest,
  sid: string,
  deps: StreamDeps,
): () => void {
  const { getState, setState, message, showSqlResults, pageSize, onScrollToBottom, onMessagesReloaded, getSessionTitle } = deps;

  let currentNodeName: string | null = null;
  let currentBlockIndex = -1;

  // 人机回路恢复时，从已有 nodeBlocks 末尾接续，避免重复建块
  const initialSt = getState(sid);
  if (initialSt.nodeBlocks.length > 0) {
    const lastBlock = initialSt.nodeBlocks[initialSt.nodeBlocks.length - 1];
    if (lastBlock && lastBlock.length > 0) {
      currentNodeName = lastBlock[0].nodeName;
      currentBlockIndex = initialSt.nodeBlocks.length - 1;
    }
  }

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

      // ---- ReportGeneratorNode：流式累积报告内容 ----
      if (data.nodeName === 'ReportGeneratorNode') {
        const isNewNode = currentNodeName === null || data.nodeName !== currentNodeName;
        if (isNewNode) {
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
      }

      // ---- RESULT_SET：新建独立块 ----
      else if (data.textType === 'RESULT_SET') {
        st.nodeBlocks.push([{ ...data }]);
        currentBlockIndex = st.nodeBlocks.length - 1;
        currentNodeName = 'result_set';
        setState(sid, { nodeBlocks: [...st.nodeBlocks] });
      }

      // ---- 其他节点：按 nodeName 分组 ----
      else {
        const isNewNode = currentNodeName === null || data.nodeName !== currentNodeName;
        if (isNewNode) {
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
      // 保留 nodeBlocks，让用户看到已完成的步骤
      setState(sid, { isStreaming: false, closeStream: null });
    },

    onComplete: async () => {
      const st = getState(sid);

      // 只保存最终报告到后端，中间节点不持久化
      if (st.htmlReportContent) {
        await chatService.saveMessage(sid, {
          sessionId: sid, role: 'assistant', content: st.htmlReportContent, messageType: 'html-report',
        }).catch(() => {});
      } else if (st.markdownReportContent) {
        await chatService.saveMessage(sid, {
          sessionId: sid, role: 'assistant', content: st.markdownReportContent, messageType: 'markdown-report',
        }).catch(() => {});
      }

      // 流完成后保留 nodeBlocks，思维链持续展示；下次发送时 doStreamRequest 会清空
      setState(sid, { isStreaming: false, closeStream: null });

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
      // 保留 nodeBlocks 供 HumanFeedback 面板展示计划步骤
      setState(sid, {
        isStreaming: false,
        showHumanFeedback: true,
        lastRequest: st.lastRequest,
        currentThreadId: threadId || st.lastRequest?.threadId || '',
      });
    },
  });
}
