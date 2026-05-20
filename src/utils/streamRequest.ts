import { streamSearch } from '../services/graph';
import { chatService } from '../services/chat';
import type { GraphNodeResponse, GraphRequest, ChatMessage } from '../types';
import type { V2TimelineContentType, V2TimelineEntry } from '../types/v2Timeline';
import type { SessionState } from '../stores/sessionStateStore';
import { useExecutionStore } from '../stores/executionStore';
import { useRunStore } from '../stores/runStore';
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
  /** [阶段3] V2 使用 Workbench，不驱动 V1 ExecutionDrawer */
  useV2Workbench?: boolean;
}

// [阶段1] 后端 V2 agentName → 前端 Round 显示名（Insight 映射为 Analyst）
const AGENT_NAME_FROM_SSE: Record<string, AgentName> = {
  Explorer: 'Explorer',
  Insight: 'Analyst',
  Reporter: 'Reporter',
};

function v2AgentRoundIndex(agent: AgentName): number {
  if (agent === 'Explorer') return 1;
  if (agent === 'Analyst') return 2;
  return 3;
}

/** [阶段5] 仅节流滚动；文案每个 token 立即更新，保证逐字效果 */
const scrollRafBySid = new Map<string, number>();

/** [阶段5] 新一次 SSE 前取消待执行的滚动 */
export function resetStreamTextBuffer(sid: string) {
  const raf = scrollRafBySid.get(sid);
  if (raf != null) {
    cancelAnimationFrame(raf);
    scrollRafBySid.delete(sid);
  }
}

function truncateDetail(text: string, max = 280): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function setV2Timeline(sid: string, deps: StreamDeps, timeline: V2TimelineEntry[]) {
  deps.setState(sid, { v2Timeline: timeline });
}

function resolveContentType(textType?: string): V2TimelineContentType {
  if (textType === 'SQL') return 'sql';
  if (textType === 'RESULT_SET') return 'result_set';
  if (textType === 'MARK_DOWN') return 'markdown';
  return 'text';
}

function appendV2Think(sid: string, deps: StreamDeps, data: GraphNodeResponse) {
  const title = (data.summary || data.text || '').trim();
  if (!title) return;
  const body = (data.text || '').trim();
  const content = body && body !== title ? body : body || undefined;
  const st = deps.getState(sid);
  const timeline = [...(st.v2Timeline || [])];
  const last = timeline[timeline.length - 1];
  if (last?.kind === 'think' && last.title === title && last.status === 'ok') {
    if (content && !last.content) {
      timeline[timeline.length - 1] = {
        ...last,
        content,
        detail: truncateDetail(content),
        contentType: resolveContentType(data.textType),
      };
      setV2Timeline(sid, deps, timeline);
    }
    return;
  }
  timeline.push({
    id: `think-${timeline.length}-${Date.now()}`,
    kind: 'think',
    title,
    detail: content ? truncateDetail(content) : undefined,
    content,
    contentType: content ? resolveContentType(data.textType) : undefined,
    status: data.status === 'running' ? 'running' : 'ok',
    agentName: data.agentName,
  });
  setV2Timeline(sid, deps, timeline);
}

function appendV2Clarify(sid: string, deps: StreamDeps, data: GraphNodeResponse) {
  const raw = (data.text || data.summary || '').trim();
  const content = raw.replace(/^需要澄清:\s*/, '') || raw;
  const st = deps.getState(sid);
  const timeline = [...(st.v2Timeline || [])];
  timeline.push({
    id: `clarify-${timeline.length}`,
    kind: 'clarify',
    title: '需要澄清',
    detail: content ? truncateDetail(content) : undefined,
    content: content || undefined,
    contentType: 'text',
    status: 'running',
  });
  setV2Timeline(sid, deps, timeline);
}

function startV2Tool(
  sid: string,
  deps: StreamDeps,
  data: GraphNodeResponse,
) {
  const toolName = data.action || 'tool';
  const st = deps.getState(sid);
  const timeline = [...(st.v2Timeline || [])];
  const title = data.summary?.trim() || `执行 ${toolName}`;
  const callBody = (data.text || '').trim();
  timeline.push({
    id: `${data.runId || 'run'}-${toolName}-${timeline.length}`,
    kind: 'tool',
    title,
    detail: callBody ? truncateDetail(callBody) : undefined,
    content: callBody || undefined,
    contentType: callBody ? resolveContentType(data.textType) : undefined,
    status: 'running',
    toolName,
    agentName: data.agentName,
  });
  setV2Timeline(sid, deps, timeline);
}

function completeV2Tool(
  sid: string,
  deps: StreamDeps,
  data: GraphNodeResponse,
) {
  const toolName = data.action || '';
  const st = deps.getState(sid);
  const timeline = [...(st.v2Timeline || [])];
  const idx = [...timeline]
    .map((e, i) => (e.kind === 'tool' && e.toolName === toolName && e.status === 'running' ? i : -1))
    .filter((i) => i >= 0)
    .pop();
  const resultContent = buildToolResultContent(data);
  const resultDetail = buildToolResultDetail(data);
  const resultType = resolveContentType(data.textType);

  if (idx === undefined) {
    timeline.push({
      id: `tool-done-${timeline.length}`,
      kind: 'tool',
      title: data.summary?.trim() || toolName || '工具完成',
      detail: resultDetail,
      content: resultContent,
      contentType: resultContent ? resultType : undefined,
      status: data.status === 'error' ? 'error' : 'ok',
      toolName: toolName || undefined,
      agentName: data.agentName,
    });
  } else {
    const prev = timeline[idx];
    timeline[idx] = {
      ...prev,
      title: data.summary?.trim() || prev.title,
      detail: resultDetail || prev.detail,
      content: resultContent || prev.content,
      contentType: resultContent ? resultType : prev.contentType,
      status: data.status === 'error' ? 'error' : 'ok',
      agentName: data.agentName || prev.agentName,
    };
  }
  setV2Timeline(sid, deps, timeline);
}

function buildToolResultDetail(data: GraphNodeResponse): string | undefined {
  if (data.textType === 'RESULT_SET') return '已返回查询结果，展开查看表格';
  if (data.summary?.trim()) return truncateDetail(data.summary);
  if (!data.text?.trim()) return undefined;
  return truncateDetail(data.text);
}

function buildToolResultContent(data: GraphNodeResponse): string | undefined {
  const text = data.text?.trim();
  if (!text) return data.summary?.trim() || undefined;
  return text;
}

function scheduleScrollThrottled(sid: string, deps: StreamDeps) {
  if (scrollRafBySid.has(sid)) return;
  const raf = requestAnimationFrame(() => {
    scrollRafBySid.delete(sid);
    deps.onScrollToBottom();
  });
  scrollRafBySid.set(sid, raf);
}

/** [阶段5] 每个 text.delta 立即写入状态（逐字）；rAF 只用于滚动 */
function appendStreamingTextImmediate(
  sid: string,
  deps: StreamDeps,
  data: GraphNodeResponse,
) {
  if (!data.text) return;
  const st = deps.getState(sid);
  const next = (st.streamingAssistantText || '') + data.text;
  const textType = data.textType || st.streamingTextType || 'TEXT';
  const patch: Partial<SessionState> = {
    streamingAssistantText: next,
    streamingTextType: textType,
  };
  if (textType === 'MARK_DOWN') {
    patch.markdownReportContent = (st.markdownReportContent || '') + data.text;
  }
  deps.setState(sid, patch);
  scheduleScrollThrottled(sid, deps);
}

function resolveV2Agent(data: GraphNodeResponse): AgentName {
  if (data.agentName && AGENT_NAME_FROM_SSE[data.agentName]) {
    return AGENT_NAME_FROM_SSE[data.agentName];
  }
  return 'Explorer';
}

/**
 * [阶段1] V2 SSE：按 eventType 更新执行抽屉与 nodeBlocks（RESULT_SET 等）
 */
function applyV2Event(data: GraphNodeResponse, sid: string, deps: StreamDeps): boolean {
  if (!data.eventType) return false;

  const v2Only = deps.useV2Workbench === true;
  const execStore = useExecutionStore.getState();
  const { getState, setState } = deps;
  const toolKey = data.action || '';

  if (data.eventType === 'clarification.requested') {
    if (!v2Only) {
      execStore.setThinking('需要澄清', data.summary || data.text || '');
    }
    return true;
  }

  if (data.eventType === 'agent.think') {
    if (!v2Only && data.summary) {
      execStore.setThinking(data.summary, '');
    }
    return true;
  }

  if (data.eventType === 'text.delta') {
    return true;
  }

  if (data.eventType === 'tool.call' && toolKey) {
    const agent = resolveV2Agent(data);
    if (!v2Only) {
      execStore.openDrawer();
      execStore.setThinking(data.summary || `正在执行 ${toolKey}…`, '');
      execStore.upsertRound(agent, v2AgentRoundIndex(agent));
      execStore.addToolCall(agent, {
        id: data.runId || toolKey,
        name: toolKey,
        status: 'running',
      });
    }
    return true;
  }

  if (data.eventType === 'tool.result' && toolKey) {
    const agent = resolveV2Agent(data);
    if (!v2Only) {
      execStore.updateToolCallStatus(
        agent,
        toolKey,
        data.status === 'error' ? 'error' : 'done',
        data.summary,
      );
    }
    const st = getState(sid);
    if (data.textType === 'RESULT_SET' && data.text) {
      st.nodeBlocks.push([{ ...data, nodeName: 'SqlExecuteNode' }]);
      setState(sid, { nodeBlocks: [...st.nodeBlocks] });
    } else if (data.textType === 'SQL' && data.text) {
      st.nodeBlocks.push([{ ...data, nodeName: 'SqlGenerateNode' }]);
      setState(sid, { nodeBlocks: [...st.nodeBlocks] });
    } else if (data.textType === 'HTML' && data.text) {
      st.htmlReportContent = (st.htmlReportContent || '') + data.text;
      setState(sid, { htmlReportContent: st.htmlReportContent });
    } else if (data.textType === 'MARK_DOWN' && data.text) {
      st.markdownReportContent = (st.markdownReportContent || '') + data.text;
      setState(sid, { markdownReportContent: st.markdownReportContent });
    }
    return true;
  }

  if (data.eventType === 'run.complete' || data.eventType === 'agent.complete') {
    if (!v2Only) {
      const agent = resolveV2Agent(data);
      execStore.updateRoundStatus(agent, 'done');
      if (data.eventType === 'run.complete') {
        execStore.clearThinking();
      }
    }
    return true;
  }

  if (data.eventType === 'error') {
    if (!v2Only) {
      execStore.markError();
      execStore.clearThinking();
    }
    return true;
  }

  return false;
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
        const errText =
          typeof data.error === 'string' ? data.error : data.text || '处理错误';
        message.error(`处理错误: ${errText}`);
        return;
      }

      // [阶段1] V2：eventType 优先于 V1 nodeName
      if (data.eventType) {
        if (data.eventType === 'text.delta') {
          appendStreamingTextImmediate(sid, deps, data);
        } else if (data.eventType === 'agent.think') {
          appendV2Think(sid, deps, data);
        } else if (data.eventType === 'clarification.requested') {
          appendV2Clarify(sid, deps, data);
        } else if (data.eventType === 'tool.call') {
          startV2Tool(sid, deps, data);
          useRunStore.getState().applyV2Event(data);
          applyV2Event(data, sid, {
            ...deps,
            useV2Workbench: request.runtime === 'v2',
          });
          onScrollToBottom();
        } else if (data.eventType === 'tool.result') {
          completeV2Tool(sid, deps, data);
          useRunStore.getState().applyV2Event(data);
          applyV2Event(data, sid, {
            ...deps,
            useV2Workbench: request.runtime === 'v2',
          });
          onScrollToBottom();
        } else {
          useRunStore.getState().applyV2Event(data);
          applyV2Event(data, sid, {
            ...deps,
            useV2Workbench: request.runtime === 'v2',
          });
          if (data.eventType === 'tool.result' || data.eventType === 'tool.call') {
            onScrollToBottom();
          }
        }

        const st = getState(sid);
        if (st.lastRequest && data.threadId) {
          setState(sid, {
            lastRequest: { ...st.lastRequest, threadId: data.threadId },
          });
        }
        return;
      }

      // [阶段5] V1 路径暂无 text.delta；主聊区流式见 V2

      // ★ 执行面板 + 思考气泡状态更新 (V1: nodeName 硬编码映射)
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
      resetStreamTextBuffer(sid);
      message.error(`流式请求失败: ${error}`);
      // 保留 nodeBlocks，让用户看到已完成的步骤
      setState(sid, {
        isStreaming: false,
        closeStream: null,
        streamingAssistantText: '',
        streamingTextType: 'TEXT',
      });

      // ★ SSE 错误：最后一个 running tool/round → error (红), 区别于用户手动停止的 skipped (灰)
      const execStore = useExecutionStore.getState();
      execStore.markError();  // 仅标记最后 running 的 tool/round, 已完成的保持原状
      execStore.clearThinking();
    },

    onComplete: async () => {
      resetStreamTextBuffer(sid);
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
      } else if (st.streamingAssistantText?.trim()) {
        await chatService.saveMessage(sid, {
          sessionId: sid,
          role: 'assistant',
          content: st.streamingAssistantText.trim(),
          messageType: 'text',
        }).catch(() => {});
      }

      // 流完成后保留 nodeBlocks；streaming 清空见消息 reload 之后
      setState(sid, {
        isStreaming: false,
        closeStream: null,
      });

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

      // 先展示持久化消息，再移除流式气泡，避免结束瞬间闪一下
      setState(sid, {
        streamingAssistantText: '',
        streamingTextType: 'TEXT',
      });
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
