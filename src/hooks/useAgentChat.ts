import { useEffect, useState, useCallback, useRef } from 'react';
import { App } from 'antd';
import { agentService } from '../services/agent';
import { chatService } from '../services/chat';
import { useSessionStateStore } from '../stores/sessionStateStore';
import { generateNodeHtml } from '../utils/nodeFormat';
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

  // Agent
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  // Session & messages
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const sessionsRef = useRef<ChatSession[]>([]);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  // Input
  const [inputQuery, setInputQuery] = useState('');

  // Options
  const [humanFeedback, setHumanFeedback] = useState(false);
  const [nl2sqlOnly, setNl2sqlOnly] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSqlResults, setShowSqlResults] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [reportFormat, setReportFormat] = useState<'markdown' | 'html'>('markdown');
  const [inputControlsCollapsed, setInputControlsCollapsed] = useState(false);

  // Report
  const [showFullscreenReport, setShowFullscreenReport] = useState(false);
  const [fullscreenReportContent, setFullscreenReportContent] = useState('');
  const [reportDownloading, setReportDownloading] = useState(false);

  // Refs
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

  // Zustand store
  const { getState, setState } = useSessionStateStore();
  const sessionState = currentSessionId ? getState(currentSessionId) : null;

  // ---- load agent ----
  useEffect(() => {
    agentService.get(agentId)
      .then((res) => setAgent(res.data.data || null))
      .catch(() => message.error('加载智能体失败'))
      .finally(() => setLoading(false));
  }, [agentId]);

  // ---- auto-scroll ----
  const scrollToBottom = useCallback(() => {
    if (!autoScroll) return;
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });
  }, [autoScroll]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sessionState?.nodeBlocks, scrollToBottom]);

  // ---- save message helper ----
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
      return res.data.data as ChatMessage;
    } catch {
      return null;
    }
  }, []);

  // ---- stream request builder ----
  const doStreamRequest = useCallback((request: GraphRequest) => {
    const sid = currentSessionIdRef.current;
    if (!sid) return;

    setState(sid, {
      isStreaming: true, nodeBlocks: [], lastRequest: request,
      htmlReportContent: '', htmlReportSize: 0, markdownReportContent: '',
      closeStream: null, showHumanFeedback: false, rejectCount: 0, currentThreadId: '',
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

  // ---- send message ----
  const handleSend = useCallback(async (queryText?: string) => {
    let sid = currentSessionIdRef.current;
    const query = (queryText || inputQueryRef.current).trim();
    if (!query || !agentId) return;

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

    const st = getState(sid);
    if (st?.isStreaming) {
      message.warning('智能体正在处理中，请稍后...');
      return;
    }

    setInputQuery('');

    const needsTitle = messagesRef.current.length === 0;

    const savedUser = await saveMessage(sid, 'user', query, 'text', needsTitle);
    setMessages((prev) => [...prev, {
      id: savedUser?.id || String(Date.now()),
      sessionId: sid,
      role: 'user',
      content: query,
      messageType: 'text',
      createTime: new Date().toISOString(),
    }]);

    doStreamRequest({
      agentId,
      query,
      humanFeedback: humanFeedbackRef.current,
      rejectedPlan: false,
      nl2sqlOnly: nl2sqlOnlyRef.current,
    });
  }, [agentId, getState, doStreamRequest, saveMessage, message]);

  // ---- stop streaming ----
  const handleStop = useCallback(async () => {
    if (!currentSessionId) return;

    const st = getState(currentSessionId);
    if (!st?.closeStream) {
      message.warning('没有正在进行的对话');
      return;
    }

    st.closeStream();
    setState(currentSessionId, { closeStream: null });

    if (st.nodeBlocks && st.nodeBlocks.length > 0) {
      await Promise.all(st.nodeBlocks.map((block) => {
        if (!block || !block.length) return Promise.resolve();
        const html = generateNodeHtml(block, showSqlResults, pageSize);
        return chatService.saveMessage(currentSessionId, {
          sessionId: currentSessionId, role: 'assistant', content: html, messageType: 'html',
        }).catch((err) => console.error('保存AI消息失败:', err));
      }));
    }

    setState(currentSessionId, {
      isStreaming: false, nodeBlocks: [],
      htmlReportContent: '', htmlReportSize: 0, markdownReportContent: '',
    });

    message.success('已停止对话');

    try {
      const res = await chatService.getSessionMessages(currentSessionId);
      setMessages((res.data.data || []) as ChatMessage[]);
    } catch { /* ignore */ }
  }, [currentSessionId, getState, setState, showSqlResults, pageSize, message]);

  // ---- human feedback ----
  const handleFeedback = useCallback(async (approved: boolean, feedbackContent: string) => {
    const st = currentSessionId ? getState(currentSessionId) : null;
    if (!st || !currentSessionId) return;

    setState(currentSessionId, { showHumanFeedback: false });
    setState(currentSessionId, {
      rejectCount: approved ? st.rejectCount : st.rejectCount + 1,
    });

    doStreamRequest({
      agentId,
      threadId: st.currentThreadId || st.lastRequest?.threadId,
      query: st.lastRequest?.query || '',
      humanFeedback: true,
      humanFeedbackContent: feedbackContent.trim() || 'Accept',
      rejectedPlan: !approved,
      nl2sqlOnly: st.lastRequest?.nl2sqlOnly || false,
    });
  }, [agentId, currentSessionId, getState, setState, doStreamRequest]);

  // ---- preset question click ----
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
        // Clear old session's messages and switch to new session
        setMessages([]);
        setCurrentSessionId(session.id);
        currentSessionIdRef.current = session.id;
        // Refresh sidebar to show new session
        setSidebarRefreshKey((k) => k + 1);
        handleSend(question);
      } else {
        message.error('创建会话失败');
      }
    } catch {
      message.error('创建会话失败');
    }
  }, [agentId, getState, handleSend, message, setSidebarRefreshKey]);

  // ---- NL2SQL / human feedback mutual exclusion ----
  const handleNl2sqlChange = useCallback((checked: boolean) => {
    setNl2sqlOnly(checked);
    if (checked) setHumanFeedback(false);
  }, []);

  // ---- report download ----
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

  // ---- fullscreen ----
  const openFullscreen = useCallback((content: string) => {
    setFullscreenReportContent(content);
    setShowFullscreenReport(true);
  }, []);

  // ---- get markdown content from streaming block ----
  const getMarkdownFromBlock = useCallback((nodes: GraphNodeResponse[]): string => {
    if (!nodes || !nodes.length) return '';
    const first = nodes[0];
    if (first.nodeName === 'ReportGeneratorNode' && first.textType === 'MARK_DOWN') {
      const st = currentSessionId ? getState(currentSessionId) : null;
      return st?.markdownReportContent || '';
    }
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

  // ---- session selection ----
  const handleSelectSession = useCallback(async (session: ChatSession | null) => {
    if (currentSessionId) {
      const cur = getState(currentSessionId);
      if (cur) setState(currentSessionId, { ...cur });
    }
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
