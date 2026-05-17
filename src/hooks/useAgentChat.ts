import { useEffect, useState, useCallback, useRef } from 'react';
import { App } from 'antd';
import { agentService } from '../services/agent';
import { chatService } from '../services/chat';
import { useSessionStateStore } from '../stores/sessionStateStore';
import { sendGraphRequest } from '../utils/streamRequest';
import type { Agent, ChatSession, ChatMessage, GraphNodeResponse, GraphRequest } from '../types';

// ---- global helpers (install once) ----
let globalHelpersInstalled = false;

function installGlobalHelpers() {
  if (typeof window === 'undefined' || globalHelpersInstalled) return;
  if (!(window as any).resultSetPage) {
    (window as any).resultSetPage = (btn: HTMLElement, direction: 'prev' | 'next') => {
      const container = btn.closest('.result-set-container');
      if (!container) return;
      const currentPageEl = container.querySelector('.result-set-current-page') as HTMLElement;
      const prevBtn = container.querySelector('.result-set-pagination-prev') as HTMLButtonElement;
      const nextBtn = container.querySelector('.result-set-pagination-next') as HTMLButtonElement;
      const pages = container.querySelectorAll('.result-set-page');
      if (!currentPageEl || !prevBtn || !nextBtn || pages.length === 0) return;

      let currentPage = parseInt(currentPageEl.textContent || '1');
      const totalPages = pages.length;
      if (direction === 'prev' && currentPage > 1) currentPage--;
      else if (direction === 'next' && currentPage < totalPages) currentPage++;

      pages.forEach((p) => p.classList.remove('result-set-page-active'));
      const target = container.querySelector(`.result-set-page[data-page="${currentPage}"]`);
      if (target) target.classList.add('result-set-page-active');
      currentPageEl.textContent = String(currentPage);
      prevBtn.disabled = currentPage === 1;
      nextBtn.disabled = currentPage === totalPages;
    };
  }
  globalHelpersInstalled = true;
}

export function useAgentChat(agentId: number) {
  const { message } = App.useApp();

  installGlobalHelpers();

  // ==============================
  // 本地 UI 状态
  // ==============================

  // Agent 信息
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  // 当前会话 & 消息列表
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sessionsRef = useRef<ChatSession[]>([]);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  // 输入框
  const [inputQuery, setInputQuery] = useState('');

  // 开关 / 选项
  const [humanFeedback, setHumanFeedback] = useState(false);
  const [nl2sqlOnly, setNl2sqlOnly] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSqlResults, setShowSqlResults] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [reportFormat, setReportFormat] = useState<'markdown' | 'html'>('markdown');
  const [inputControlsCollapsed, setInputControlsCollapsed] = useState(false);

  // 全屏报告
  const [showFullscreenReport, setShowFullscreenReport] = useState(false);
  const [fullscreenReportContent, setFullscreenReportContent] = useState('');
  const [reportDownloading, setReportDownloading] = useState(false);

  // ==============================
  // Ref：让回调始终读到最新值，避免闭包陷阱
  // ==============================
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const currentSessionIdRef = useRef(currentSessionId);
  currentSessionIdRef.current = currentSessionId;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const humanFeedbackRef = useRef(humanFeedback);
  humanFeedbackRef.current = humanFeedback;
  const nl2sqlOnlyRef = useRef(nl2sqlOnly);
  nl2sqlOnlyRef.current = nl2sqlOnly;
  const inputQueryRef = useRef(inputQuery);
  inputQueryRef.current = inputQuery;

  // ==============================
  // Zustand：跨组件共享的会话运行时状态（流式块、暂停、报告等）
  // ==============================
  const { getState, setState } = useSessionStateStore();
  const sessionState = currentSessionId ? getState(currentSessionId) : null;

  // ---- 加载智能体信息 ----
  useEffect(() => {
    agentService.get(agentId)
      .then((res) => setAgent(res.data.data || null))
      .catch(() => message.error('加载智能体失败'))
      .finally(() => setLoading(false));
  }, [agentId]);

  // ---- 自动滚动到底部 ----
  const scrollToBottom = useCallback(() => {
    if (!autoScroll) return;
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });
  }, [autoScroll]);

  // 消息列表或流式块变化时触发滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages, sessionState?.nodeBlocks, scrollToBottom]);

  // ---- 持久化单条消息到后端 ----
  const saveMessage = useCallback(async (
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    messageType: string,
    titleNeeded?: boolean,
    metadata?: Record<string, unknown>,
  ) => {
    try {
      const res = await chatService.saveMessage(sessionId, {
        sessionId, role, content, messageType: messageType as any, titleNeeded, metadata,
      });
      // TODO: 这里的类型强转，不太好吧
      
      return res.data.data as ChatMessage;
    } catch {
      return null;
    }
  }, []);

  // ---- 构建 SSE 流式请求，交由 streamRequest 执行 ----
  const doStreamRequest = useCallback((request: GraphRequest, preserveNodeBlocks = false) => {
    const sid = currentSessionIdRef.current;
    if (!sid) return;

    // 保留上次的 rejectCount，避免人机回路中拒绝累计次数被重置
    const prev = getState(sid);

    setState(sid, {
      isStreaming: true,
      // 人机回路恢复时保留旧 nodeBlocks，思维链不中断
      nodeBlocks: preserveNodeBlocks ? (prev?.nodeBlocks || []) : [],
      lastRequest: request,
      htmlReportContent: '',
      htmlReportSize: 0,
      markdownReportContent: '',
      closeStream: null,
      showHumanFeedback: false,
      rejectCount: prev?.rejectCount || 0,
      currentThreadId: request.threadId || prev?.currentThreadId || '',
    });

    const closeFn = sendGraphRequest(request, sid, {
      getState,
      setState,
      message,
      showSqlResults,
      pageSize,
      onScrollToBottom: scrollToBottom,
      onMessagesReloaded: (msgs) => {
        setMessages(msgs);
      },
      getSessionTitle: () => {
        return currentSessionId ? (sessionsRef.current.find((s) => s.id === currentSessionId)?.title || '') : '';
      },
    });

    setState(sid, { closeStream: closeFn });
  }, [getState, setState, message, showSqlResults, pageSize, scrollToBottom]);

  // ---- 发送消息入口：无会话则自动创建，已有流则阻止，否则保存+发起 SSE ----
  const handleSend = useCallback(async (queryText?: string) => {
    let sid = currentSessionIdRef.current;
    const query = (queryText || inputQueryRef.current).trim();
    if (!query || !agentId) return;

    // 无会话时自动创建
    if (!sid) {
      try {
        const res = await chatService.createSession(agentId, { title: '新会话', userId: 1 });
        const session = res.data.data as ChatSession;
        if (session) {
          sid = session.id;
          setCurrentSessionId(session.id);
          currentSessionIdRef.current = session.id;
          message.success('新会话创建成功');
        } else {
          message.error('创建会话失败');
          return;
        }
      } catch {
        message.error('创建会话失败');
        return;
      }
    }

    // 防止重复发送（流式进行中）
    const st = getState(sid);
    if (st?.isStreaming) {
      message.warning('智能体正在处理中，请稍后...');
      return;
    }

    setInputQuery('');

    // 首条消息触发标题生成
    const needsTitle = messagesRef.current.length === 0;

    // 1. 持久化用户消息到后端
    const savedUser = await saveMessage(sid, 'user', query, 'text', needsTitle);
    // 2. 立即添加到本地 state 展示用户气泡
    setMessages((prev) => [...prev, {
      id: savedUser?.id || String(Date.now()),
      sessionId: sid,
      role: 'user',
      content: query,
      messageType: 'text',
      createTime: new Date().toISOString(),
    }]);

    // 3. 发起 SSE 流式请求
    doStreamRequest({
      agentId,
      query,
      humanFeedback: humanFeedbackRef.current,
      rejectedPlan: false,
      nl2sqlOnly: nl2sqlOnlyRef.current,
    });
  }, [agentId, getState, doStreamRequest, saveMessage, message]);

  // ---- 停止 SSE 流：关闭连接，保留 nodeBlocks 展示已完成的思考链 ----
  const handleStop = useCallback(async () => {
    if (!currentSessionId) return;

    const st = getState(currentSessionId);
    if (!st?.closeStream) {
      message.warning('没有正在进行的对话');
      return;
    }

    // 调用 AbortController 关闭 SSE 连接
    st.closeStream();

    // 保留 nodeBlocks（不清空），前端继续展示"思考完成"的思维链
    setState(currentSessionId, {
      isStreaming: false,
      closeStream: null,
    });

    message.success('已停止对话');
  }, [currentSessionId, getState, setState, message]);

  // ---- 人机回路：批准/拒绝计划，携带 threadId 恢复 SSE 流 ----
  const handleFeedback = useCallback(async (approved: boolean, feedbackContent: string) => {
    const st = currentSessionId ? getState(currentSessionId) : null;
    if (!st || !currentSessionId) return;

    // 合并 setState 调用：隐藏反馈面板 + 累加拒绝次数
    setState(currentSessionId, {
      showHumanFeedback: false,
      rejectCount: approved ? st.rejectCount : st.rejectCount + 1,
    });

    // 用 currentThreadId 或 lastRequest.threadId 恢复被中断的图执行
    // preserveNodeBlocks=true → 保留暂停前的思维链，新节点追加到已有时间线
    doStreamRequest({
      agentId,
      threadId: st.currentThreadId || st.lastRequest?.threadId,
      query: st.lastRequest?.query || '',
      humanFeedback: true,
      humanFeedbackContent: feedbackContent.trim() || 'Accept',
      rejectedPlan: !approved,
      nl2sqlOnly: st.lastRequest?.nl2sqlOnly || false,
    }, true);
  }, [agentId, currentSessionId, getState, setState, doStreamRequest]);

  // ---- 点击预设问题 → 创建新会话并发送 ----
  const handlePresetQuestionClick = useCallback(async (question: string) => {
    const sid = currentSessionIdRef.current;
    const st = sid ? getState(sid) : null;
    if (st?.isStreaming) {
      message.warning('智能体正在处理中，请稍后...');
      return;
    }

    try {
      const res = await chatService.createSession(agentId, { title: question.slice(0, 30), userId: 1 });
      const session = res.data.data as ChatSession;
      if (session) {
        // 清空旧会话消息，切换到新会话
        setMessages([]);
        setCurrentSessionId(session.id);
        currentSessionIdRef.current = session.id;
        // 刷新侧边栏显示新会话
        setSidebarRefreshKey((k) => k + 1);
        handleSend(question);
      } else {
        message.error('创建会话失败');
      }
    } catch {
      message.error('创建会话失败');
    }
  }, [agentId, getState, handleSend, message, setSidebarRefreshKey]);

  // ---- NL2SQL 与人工反馈互斥 ----
  const handleNl2sqlChange = useCallback((checked: boolean) => {
    setNl2sqlOnly(checked);
    if (checked) setHumanFeedback(false);
  }, []);

  // ---- 报告下载（Markdown / HTML） ----
  const handleDownloadMarkdown = useCallback((content: string) => {
    if (!content) { message.warning('没有可下载的Markdown报告'); return; }
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `report_${new Date().getTime()}.md`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Markdown报告下载成功');
  }, [message]);

  const handleDownloadHtml = useCallback(async (content?: string) => {
    if (!currentSessionId) return;
    setReportDownloading(true);
    try {
      await chatService.downloadHtmlReport(currentSessionId);
      message.success('HTML报告下载成功');
    } catch {
      const st = currentSessionId ? getState(currentSessionId) : null;
      const md = content || st?.markdownReportContent || '';
      if (md) {
        try {
          const { buildReportHtml } = await import('../components/run/report-html-template');
          const html = buildReportHtml(md);
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `report-${currentSessionId}.html`;
          a.click(); URL.revokeObjectURL(url);
          message.success('HTML报告下载成功');
        } catch { message.error('下载失败'); }
      } else {
        message.error('下载HTML报告失败');
      }
    } finally { setReportDownloading(false); }
  }, [currentSessionId, getState, message]);

  // ---- 打开全屏报告弹窗 ----
  const openFullscreen = useCallback((content: string) => {
    setFullscreenReportContent(content);
    setShowFullscreenReport(true);
  }, []);

  // ---- 从流式 block 中提取 Markdown 报告内容 ----
  const getMarkdownFromBlock = useCallback((nodes: GraphNodeResponse[]): string => {
    if (!nodes || !nodes.length) return '';
    const first = nodes[0];
    // ReportGeneratorNode 的 MARK_DOWN 从 store 中实时读取
    if (first.nodeName === 'ReportGeneratorNode' && first.textType === 'MARK_DOWN') {
      const st = currentSessionId ? getState(currentSessionId) : null;
      return st?.markdownReportContent || '';
    }
    // 其他节点连续 MARK_DOWN 文本的拼接
    let md = '';
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].textType === 'MARK_DOWN') {
        let p = i;
        for (; p < nodes.length; p++) {
          if (nodes[p].textType !== 'MARK_DOWN') break;
          md += nodes[p].text;
        }
        if (p < nodes.length) i = p - 1;
        else break;
      }
    }
    return md;
  }, [currentSessionId, getState]);

  // ---- 切换会话：保存当前会话状态，加载目标会话消息 ----
  const handleSelectSession = useCallback(async (session: ChatSession | null) => {
    // 离开当前会话前保存运行时状态
    if (currentSessionId) {
      const cur = getState(currentSessionId);
      if (cur) setState(currentSessionId, { ...cur });
    }
    // 空会话（id 为空）→ 清空展示
    if (!session || !session.id) {
      setCurrentSessionId('');
      setMessages([]);
      return;
    }
    setCurrentSessionId(session.id);
    try {
      const res = await chatService.getSessionMessages(session.id);
      setMessages((res.data.data || []) as ChatMessage[]);
    } catch { setMessages([]); }
    scrollToBottom();
  }, [currentSessionId, getState, setState, scrollToBottom]);

  return {
    agent, loading,
    currentSessionId, messages, sessionsRef,
    sidebarRefreshKey, setSidebarRefreshKey,
    sessionState,
    inputQuery, setInputQuery,
    humanFeedback, setHumanFeedback,
    nl2sqlOnly, autoScroll, setAutoScroll,
    showSqlResults, setShowSqlResults,
    pageSize, setPageSize,
    reportFormat, setReportFormat,
    inputControlsCollapsed, setInputControlsCollapsed,
    reportDownloading,
    showFullscreenReport, setShowFullscreenReport, fullscreenReportContent,
    chatContainerRef,
    handleSelectSession, handleSend, handleStop, handleFeedback,
    handlePresetQuestionClick, handleNl2sqlChange,
    handleDownloadMarkdown, handleDownloadHtml,
    openFullscreen, getMarkdownFromBlock, scrollToBottom,
  };
}
