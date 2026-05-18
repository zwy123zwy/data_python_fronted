import { streamSearch } from '../services/graph';
import { chatService } from '../services/chat';
import type { GraphNodeResponse, GraphRequest, ChatMessage } from '../types';
import type { SessionState } from '../stores/sessionStateStore';
import { useExecutionStore } from '../stores/executionStore';
import type { AgentName } from '../stores/executionStore';

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

// ==================== 执行面板映射 (Phase 1: SSE nodeName → Agent Round/Tool) ====================

interface NodeExecutionMapping {
  agentName?: AgentName;
  roundIndex?: number;
  toolName?: string;
  thinkingText: string;
  openDrawer?: boolean;    // 首个可见节点触发抽屉滑入
  finishRound?: AgentName;  // 此节点后标记对应 Round 为 done
}

// V2.0 17 个节点 → Agent Round/Tool/Thinking 映射 (spec §7.1)
// 当前 Phase 1 通过 nodeName 硬编码推断, Phase 2 后端直接发送 agentName/toolName 字段
const NODE_TO_EXECUTION: Record<string, NodeExecutionMapping> = {
  EvidenceRecallNode: {
    agentName: 'Explorer', roundIndex: 1, toolName: 'search_knowledge',
    thinkingText: '正在召回业务知识…', openDrawer: true,
  },
  QueryEnhanceNode: {
    agentName: 'Explorer', toolName: 'rewrite_query',
    thinkingText: '正在改写查询…',
  },
  SchemaRecallNode: {
    agentName: 'Explorer', toolName: 'get_schema',
    thinkingText: '正在探查数据表结构…',
  },
  TableRelationNode: {
    agentName: 'Explorer', toolName: 'find_relations',
    thinkingText: '正在分析表关联关系…',
  },
  FeasibilityAssessmentNode: {
    thinkingText: '正在制定执行计划…',
  },
  PlannerNode: {
    thinkingText: '正在制定执行计划…', finishRound: 'Explorer',
  },
  PlanExecutorNode: {
    thinkingText: '正在执行步骤…',
  },
  SqlGenerateNode: {
    agentName: 'Analyst', roundIndex: 2, toolName: 'text_to_sql',
    thinkingText: '正在生成 SQL 查询…',
  },
  SemanticConsistencyNode: {
    agentName: 'Analyst', toolName: 'semantic_check',
    thinkingText: '正在校验语义一致性…',
  },
  SqlExecuteNode: {
    agentName: 'Analyst', toolName: 'execute_sql',
    thinkingText: '正在执行 SQL 查询…',
  },
  PythonGenerateNode: {
    agentName: 'Analyst', toolName: 'text_to_python',
    thinkingText: '正在生成分析代码…',
  },
  PythonExecuteNode: {
    agentName: 'Analyst', toolName: 'run_python',
    thinkingText: '正在执行 Python 分析…',
  },
  PythonAnalyzeNode: {
    agentName: 'Analyst', toolName: 'analyze_result',
    thinkingText: '正在解读分析结果…',
  },
  ReportGeneratorNode: {
    agentName: 'Reporter', roundIndex: 3,
    thinkingText: '正在生成分析报告…', finishRound: 'Analyst',
  },
  HumanFeedbackNode: {
    thinkingText: '等待人工确认…',
  },
  IntentRecognitionNode: {
    thinkingText: '', // 内部判断，不展示
  },
  ChitchatNode: {
    thinkingText: '', // 闲聊回复，不展示执行面板
  },
};

// 截取文本首行，最大长度 maxLen
function truncateText(text: string, maxLen: number = 80): string {
  const firstLine = text.split('\n')[0].trim();
  return firstLine.length > maxLen
    ? firstLine.slice(0, maxLen) + '...'
    : firstLine;
}

// 将 SSE data 消息翻译为 executionStore 调用 (不修改 nodeBlocks 逻辑)
function handleNodeForExecution(nodeName: string, data: { text: string; textType: string; }) {
  const mapping = NODE_TO_EXECUTION[nodeName];
  if (!mapping) return;

  const execStore = useExecutionStore.getState();

  // 1. 首个可见节点时打开抽屉
  if (mapping.openDrawer) {
    execStore.openDrawer();
  }

  // 2. 思考气泡刷新
  if (mapping.thinkingText) {
    // 副文案: TEXT 类型从内容截取, SQL/PYTHON/RESULT_SET 用 tool 名拼接, 其余空
    let hint = '';
    if (data.text) {
      if (data.textType === 'TEXT') {
        hint = truncateText(data.text, 80);
      } else if (mapping.toolName && ['SQL', 'PYTHON', 'RESULT_SET'].includes(data.textType)) {
        hint = `${mapping.toolName} 输出中…`;
      }
    }
    execStore.setThinking(mapping.thinkingText, hint);
  }

  // 3. Round/Tool 状态更新
  if (mapping.agentName && mapping.roundIndex) {
    execStore.upsertRound(mapping.agentName, mapping.roundIndex);
  }
  if (mapping.agentName && mapping.toolName) {
    // addToolCall 自动完成同 Round 内上一 running tool
    execStore.addToolCall(mapping.agentName, {
      id: '',
      name: mapping.toolName,
      status: 'running',
    });
  }

  // 4. Round 完成边界 (PlannerNode → Explorer done, ReportGeneratorNode → Analyst done)
  if (mapping.finishRound) {
    execStore.updateRoundStatus(mapping.finishRound, 'done');
  }
}

// ==================== sendGraphRequest ====================

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

      // ★ 执行面板 + 思考气泡状态更新 (Phase 1: nodeName 硬编码映射)
      handleNodeForExecution(data.nodeName, {
        text: data.text,
        textType: data.textType,
      });

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

      // ★ 标记当前 running tool/round 为 error，清除思考气泡
      const execStore = useExecutionStore.getState();
      execStore.stop(); // 所有 running → skipped (stop 统一处理异常终止)
      execStore.clearThinking();
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

      // ★ 标记最后 Agent round 为 done (Reporter round 由此完成)
      const execStore = useExecutionStore.getState();
      if (execStore.lastAgentName) {
        execStore.updateRoundStatus(execStore.lastAgentName, 'done');
      }
      // 思考气泡 1s 后淡出
      setTimeout(() => {
        useExecutionStore.getState().clearThinking();
      }, 1000);

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
      // ★ 执行面板保持当前状态 (pause 不改变 executionStore)
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
