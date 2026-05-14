import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, Switch, Spin, Typography, App, Avatar, Select, Tooltip, Radio } from 'antd';
import {
  SendOutlined,
  StopOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  FullscreenOutlined,
  CloseOutlined,
  ArrowDownOutlined,
  LoadingOutlined,
  UserOutlined,
  RobotOutlined,
  CheckOutlined,
  CloseCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import 'highlight.js/styles/github.css';

hljs.registerLanguage('sql', sql);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);

import { agentService } from '../services/agent';
import { chatService } from '../services/chat';
import { streamSearch } from '../services/graph';
import { presetQuestionService } from '../services/presetQuestion';
import { useSessionStateStore } from '../stores/sessionStateStore';
import { createMarkdownIt } from '../components/run/markdown';
import ChatSessionSidebar from '../components/run/ChatSessionSidebar';
import HumanFeedback from '../components/run/HumanFeedback';
import PresetQuestions from '../components/run/PresetQuestions';
import ResultSetDisplay from '../components/run/ResultSetDisplay';
import ReportHtmlView from '../components/run/ReportHtmlView';
import type { Agent, ChatSession, ChatMessage, GraphNodeResponse, GraphRequest, ResultData, PresetQuestion } from '../types';
import { TextType } from '../types';

const { Text, Title } = Typography;
const { TextArea } = Input;

// ---- helpers (aligned with Vue's generateNodeHtml / formatNodeContent) ----

const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  marked.setOptions({ gfm: true, breaks: true });
  const rawHtml = marked.parse(markdown) as string;
  return DOMPurify.sanitize(rawHtml);
};

const generateResultSetTable = (resultSetData: { columns: string[]; data: Record<string, string>[]; errorMsg?: string }, pageSize: number): string => {
  const columns = resultSetData.columns || [];
  const allData = resultSetData.data || [];
  const total = allData.length;
  const totalPages = Math.ceil(total / pageSize);

  if (resultSetData.errorMsg) {
    return `<div class="result-set-error">错误: ${escapeHtml(resultSetData.errorMsg)}</div>`;
  }
  if (columns.length === 0 || allData.length === 0) {
    return '<div class="result-set-empty">查询结果为空</div>';
  }

  let html = `<div class="result-set-container"><div class="result-set-header"><div class="result-set-info"><span>查询结果 (共 ${total} 条记录)</span><div class="result-set-pagination-controls"><span class="result-set-pagination-info">第 <span class="result-set-current-page">1</span> 页，共 ${totalPages} 页</span><div class="result-set-pagination-buttons"><button class="result-set-pagination-btn result-set-pagination-prev" onclick="window.resultSetPage(this,'prev')" disabled>上一页</button><button class="result-set-pagination-btn result-set-pagination-next" onclick="window.resultSetPage(this,'next')" ${totalPages > 1 ? '' : 'disabled'}>下一页</button></div></div></div></div><div class="result-set-table-container">`;

  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageData = allData.slice(start, end);
    html += `<div class="result-set-page ${page === 1 ? 'result-set-page-active' : ''}" data-page="${page}"><table class="result-set-table"><thead><tr>`;
    columns.forEach((col) => { html += `<th>${escapeHtml(col)}</th>`; });
    html += '</tr></thead><tbody>';
    pageData.forEach((row) => {
      html += '<tr>';
      columns.forEach((col) => { html += `<td>${escapeHtml(row[col] || '')}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  html += '</div></div>';
  return html;
};

const formatNodeContent = (nodes: GraphNodeResponse[], showSqlResults: boolean, pageSize: number): string => {
  let content = '';

  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx];

    if (node.textType === 'HTML') {
      content += node.text;
    } else if (node.textType === 'TEXT') {
      content += node.text.replace(/\n/g, '<br>');
    } else if (node.textType === 'JSON' || node.textType === 'PYTHON' || node.textType === 'SQL') {
      let pre = '';
      let p = idx;
      for (; p < nodes.length; p++) {
        if (nodes[p].textType !== node.textType) break;
        pre += nodes[p].text;
      }
      try {
        const language = node.textType.toLowerCase();
        const highlighted = hljs.highlight(pre, { language });
        const codeForBtn = escapeHtml(pre);
        content += `<div class="code-block-wrapper">
          <div class="code-block-header">
            <span class="code-language">${language.toUpperCase()}</span>
            <button class="code-copy-button" onclick="window.copyCodeBlock(this)" data-code="${codeForBtn}">复制</button>
          </div>
          <pre class="hljs"><code class="language-${language}">${highlighted.value}</code></pre>
        </div>`;
      } catch {
        content += `<pre><code>${escapeHtml(pre)}</code></pre>`;
      }
      if (p < nodes.length) idx = p - 1;
      else break;
    } else if (node.textType === 'MARK_DOWN') {
      let markdown = '';
      let p = idx;
      for (; p < nodes.length; p++) {
        if (nodes[p].textType !== 'MARK_DOWN') break;
        markdown += nodes[p].text;
      }
      const safeHtml = markdownToHtml(markdown);
      content += `<div class="markdown-report">${safeHtml}</div>`;
      if (p < nodes.length) idx = p - 1;
      else break;
    } else if (node.textType === 'RESULT_SET') {
      if (!showSqlResults) continue;
      try {
        const resultData: ResultData = JSON.parse(node.text);
        const resultSet = resultData.resultSet;
        if (resultSet && resultData.displayStyle?.type !== 'table' && resultData.displayStyle?.type) {
          // Non-table display styles handled by ResultSetDisplay component
          continue;
        }
        if (resultSet) {
          content += generateResultSetTable(
            { columns: resultSet.columns || [], data: resultSet.data || [], errorMsg: resultSet.errorMsg },
            pageSize,
          );
        }
      } catch (e) {
        content += `<div class="result-set-error">解析结果集数据失败: ${escapeHtml((e as Error).message)}</div>`;
      }
    } else {
      content += escapeHtml(node.text);
    }
  }

  return content;
};

const generateNodeHtml = (nodes: GraphNodeResponse[], showSqlResults: boolean, pageSize: number): string => {
  const inner = formatNodeContent(nodes, showSqlResults, pageSize);
  return `<div class="agent-response-block" style="display:block!important;width:100%!important">
    <div class="agent-response-title">${nodes.length > 0 ? escapeHtml(nodes[0].nodeName) : '空节点'}</div>
    <div class="agent-response-content">${inner}</div>
  </div>`;
};

// ---- component ----

const AgentRun: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const agentId = Number(id);
  const { message } = App.useApp();

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
  const pendingSavePromisesRef = useRef<Promise<void>[]>([]);
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
  const { getState, setState, deleteState } = useSessionStateStore();
  const sessionState = currentSessionId ? getState(currentSessionId) : null;

  // Markdown-it instance
  const mdRef = useRef(createMarkdownIt());

  // ---- global helpers (install once) ----
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).resultSetPage) {
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
    // copyCodeBlock is installed by markdown-plugin-highlight
  }, []);

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

  // ---- session selection ----
  const handleSelectSession = useCallback(async (session: ChatSession | null) => {
    // Save current view state to store
    if (currentSessionId) {
      const cur = getState(currentSessionId);
      if (cur) {
        setState(currentSessionId, { ...cur });
      }
    }

    if (!session || !session.id) {
      setCurrentSessionId('');
      setMessages([]);
      return;
    }

    setCurrentSessionId(session.id);
    // Restore view from store
    const st = getState(session.id);
    try {
      const res = await chatService.getSessionMessages(session.id);
      setMessages((res.data.data || []) as ChatMessage[]);
    } catch {
      setMessages([]);
    }
    scrollToBottom();
  }, [currentSessionId, getState, setState, scrollToBottom]);

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
        sessionId,
        role,
        content,
        messageType: messageType as any,
        titleNeeded,
        metadata,
      });
      return res.data.data as ChatMessage;
    } catch {
      return null;
    }
  }, []);

  // ---- reset report state ----
  const resetReportState = useCallback((sid: string, request: GraphRequest) => {
    setState(sid, {
      isStreaming: true,
      nodeBlocks: [],
      lastRequest: request,
      htmlReportContent: '',
      htmlReportSize: 0,
      markdownReportContent: '',
      closeStream: null,
      showHumanFeedback: false,
      rejectCount: 0,
      currentThreadId: '',
    });
  }, [setState]);

  // ---- send graph request ----
  const sendGraphRequest = useCallback(async (request: GraphRequest, _rejectedPlan: boolean) => {
    const sid = currentSessionIdRef.current;
    if (!sid) return;

    const sessionState = getState(sid);
    resetReportState(sid, request);

    pendingSavePromisesRef.current = [];

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

    const closeFn = streamSearch(request, {
      onMessage: (data: GraphNodeResponse) => {
        if (data.error) {
          message.error(`处理错误: ${data.text}`);
          return;
        }

        const st = getState(sid);
        if (st.lastRequest) {
          st.lastRequest.threadId = data.threadId;
        }

        // ReportGeneratorNode
        if (data.nodeName === 'ReportGeneratorNode') {
          const isNewNode = currentNodeName === null || data.nodeName !== currentNodeName;

          if (isNewNode) {
            if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
              pendingSavePromisesRef.current.push(saveNodeBlock(st.nodeBlocks[currentBlockIndex]));
            }
            st.nodeBlocks.push([{ ...data }]);
            currentBlockIndex = st.nodeBlocks.length - 1;
            currentNodeName = data.nodeName;
          }

          if (data.textType === 'HTML') {
            st.htmlReportContent += data.text;
            st.htmlReportSize = st.htmlReportContent.length;
            const reportBlock = st.nodeBlocks.find(
              (b) => b.length > 0 && b[0].nodeName === 'ReportGeneratorNode' && b[0].textType === 'HTML',
            );
            if (reportBlock) {
              reportBlock[0].text = `正在收集HTML报告... 已收集 ${st.htmlReportSize} 字节`;
            }
          } else if (data.textType === 'MARK_DOWN') {
            st.markdownReportContent += data.text;
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
        // RESULT_SET
        else if (data.textType === 'RESULT_SET') {
          if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
            pendingSavePromisesRef.current.push(saveNodeBlock(st.nodeBlocks[currentBlockIndex]));
          }
          st.nodeBlocks.push([{ ...data }]);
          currentBlockIndex = st.nodeBlocks.length - 1;
          currentNodeName = 'result_set';
          setState(sid, { nodeBlocks: [...st.nodeBlocks] });
        }
        // Other nodes (SQL, JSON, PYTHON, TEXT, MARK_DOWN)
        else {
          const isNewNode = currentNodeName === null || data.nodeName !== currentNodeName;

          if (isNewNode) {
            if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
              pendingSavePromisesRef.current.push(saveNodeBlock(st.nodeBlocks[currentBlockIndex]));
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

        scrollToBottom();
      },

      onError: async (error: string) => {
        message.error(`流式请求失败: ${error}`);
        // Wait for pending saves
        if (pendingSavePromisesRef.current.length > 0) {
          await Promise.all(pendingSavePromisesRef.current);
        }
        setState(sid, { isStreaming: false, closeStream: null });
        // Reload messages
        try {
          const res = await chatService.getSessionMessages(sid);
          setMessages((res.data.data || []) as ChatMessage[]);
        } catch { /* ignore */ }
      },

      onComplete: async () => {
        // Wait for pending saves
        if (pendingSavePromisesRef.current.length > 0) {
          await Promise.all(pendingSavePromisesRef.current);
        }

        const st = getState(sid);

        // Save reports
        if (st.htmlReportContent) {
          const saved = await saveMessage(sid, 'assistant', st.htmlReportContent, 'html-report');
          if (saved) setMessages((prev) => [...prev, saved]);
          setState(sid, { isStreaming: false, nodeBlocks: [] });
        } else if (st.markdownReportContent) {
          const saved = await saveMessage(sid, 'assistant', st.markdownReportContent, 'markdown-report');
          if (saved) setMessages((prev) => [...prev, saved]);
          setState(sid, { isStreaming: false, nodeBlocks: [] });
        } else {
          // Save last block
          if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
            await saveNodeBlock(st.nodeBlocks[currentBlockIndex]);
          }
          setState(sid, { isStreaming: false });
        }

        const sessionTitle = currentSessionId ? (sessionsRef.current.find((s) => s.id === currentSessionId)?.title || '') : '';
        message.success(`会话[${sessionTitle}]处理完成`);

        // Reload messages
        try {
          const res = await chatService.getSessionMessages(sid);
          setMessages((res.data.data || []) as ChatMessage[]);
        } catch { /* ignore */ }
      },

      onPaused: async (threadId: string) => {
        const st = getState(sid);
        if (st.lastRequest) {
          st.lastRequest.threadId = threadId || st.lastRequest.threadId;
        }
        // Save last block
        if (currentBlockIndex >= 0 && st.nodeBlocks[currentBlockIndex]) {
          await saveNodeBlock(st.nodeBlocks[currentBlockIndex]);
        }
        if (pendingSavePromisesRef.current.length > 0) {
          await Promise.all(pendingSavePromisesRef.current);
        }
        setState(sid, {
          isStreaming: false,
          nodeBlocks: [],
          showHumanFeedback: true,
          lastRequest: st.lastRequest,
        });
      },
    });

    setState(sid, { closeStream: closeFn });
  }, [currentSessionId, getState, setState, resetReportState, showSqlResults, pageSize, scrollToBottom, saveMessage]);

  // ---- send message ----
  const handleSend = useCallback(async (queryText?: string) => {
    let sid = currentSessionIdRef.current;
    const query = (queryText || inputQueryRef.current).trim();
    if (!query || !agentId) return;

    // Auto-create session if needed
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

    // Save user message
    const savedUser = await saveMessage(sid, 'user', query, 'text', needsTitle);
    const displayUser: ChatMessage = {
      id: savedUser?.id || String(Date.now()),
      sessionId: sid,
      role: 'user',
      content: query,
      messageType: 'text',
      createTime: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, displayUser]);

    const request: GraphRequest = {
      agentId,
      query,
      humanFeedback: humanFeedbackRef.current,
      rejectedPlan: false,
      nl2sqlOnly: nl2sqlOnlyRef.current,
    };

    await sendGraphRequest(request, false);
  }, [agentId, getState, sendGraphRequest, saveMessage]);

  // ---- stop streaming ----
  const handleStop = useCallback(async () => {
    if (!currentSessionId) return;

    const st = getState(currentSessionId);
    if (!st?.closeStream) {
      message.warning('没有正在进行的对话');
      return;
    }

    // Close stream
    st.closeStream();
    setState(currentSessionId, { closeStream: null });

    // Save accumulated node blocks
    if (st.nodeBlocks && st.nodeBlocks.length > 0) {
      const savePromises = st.nodeBlocks.map((block) => {
        if (!block || !block.length) return Promise.resolve();
        const html = generateNodeHtml(block, showSqlResults, pageSize);
        return chatService.saveMessage(currentSessionId, {
          sessionId: currentSessionId,
          role: 'assistant',
          content: html,
          messageType: 'html',
        }).catch((err) => console.error('保存AI消息失败:', err));
      });
      await Promise.all(savePromises);
    }

    // Clean up state
    setState(currentSessionId, {
      isStreaming: false,
      nodeBlocks: [],
      htmlReportContent: '',
      htmlReportSize: 0,
      markdownReportContent: '',
    });

    // Reload messages
    try {
      const res = await chatService.getSessionMessages(currentSessionId);
      setMessages((res.data.data || []) as ChatMessage[]);
    } catch { /* ignore */ }

    message.success('已停止对话');
  }, [currentSessionId, getState, setState, showSqlResults, pageSize]);

  // ---- human feedback ----
  const handleFeedback = useCallback(async (approved: boolean, feedbackContent: string) => {
    const st = currentSessionId ? getState(currentSessionId) : null;
    if (!st || !currentSessionId) return;

    const content = feedbackContent.trim() || 'Accept';

    setState(currentSessionId, { showHumanFeedback: false });

    const request: GraphRequest = {
      agentId,
      threadId: st.currentThreadId || st.lastRequest?.threadId,
      query: st.lastRequest?.query || '',
      humanFeedback: true,
      humanFeedbackContent: content,
      rejectedPlan: !approved,
      nl2sqlOnly: st.lastRequest?.nl2sqlOnly || false,
    };

    setState(currentSessionId, {
      rejectCount: approved ? st.rejectCount : st.rejectCount + 1,
    });

    await sendGraphRequest(request, !approved);
  }, [agentId, currentSessionId, getState, setState, sendGraphRequest]);

  // ---- preset question click ----
  const handlePresetQuestionClick = useCallback(async (question: string) => {
    const sid = currentSessionIdRef.current;
    const st = sid ? getState(sid) : null;
    if (st?.isStreaming) {
      message.warning('智能体正在处理中，请稍后...');
      return;
    }

    // Create session if needed
    if (!sid) {
      try {
        const res = await chatService.createSession(agentId, { title: '新会话', userId: 1 });
        const session = res.data.data as ChatSession;
        if (session) {
          setCurrentSessionId(session.id);
          currentSessionIdRef.current = session.id; // immediate for closure safety
          message.success('新会话创建成功');
          handleSend(question);
          return;
        }
      } catch {
        message.error('创建会话失败');
        return;
      }
    }

    handleSend(question);
  }, [agentId, getState, handleSend]);

  // ---- NL2SQL ↔ human feedback mutual exclusion ----
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
    a.href = url;
    a.download = `report_${new Date().getTime()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Markdown报告下载成功');
  }, []);

  const handleDownloadHtml = useCallback(async (content?: string) => {
    if (!currentSessionId) return;
    setReportDownloading(true);
    try {
      // Server-side HTML download — sends content to backend which returns a blob
      if (content) {
        // For history messages: download via server
        await chatService.downloadHtmlReport(currentSessionId);
      } else {
        // For current report
        await chatService.downloadHtmlReport(currentSessionId);
      }
      message.success('HTML报告下载成功');
    } catch {
      // Fallback: generate HTML locally from markdown content
      const st = currentSessionId ? getState(currentSessionId) : null;
      const md = content || st?.markdownReportContent || '';
      if (md) {
        try {
          const { buildReportHtml } = await import('../components/run/report-html-template');
          const html = buildReportHtml(md);
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `report-${currentSessionId}.html`;
          a.click();
          URL.revokeObjectURL(url);
          message.success('HTML报告下载成功');
        } catch (e) {
          message.error('下载失败');
        }
      } else {
        message.error('下载HTML报告失败');
      }
    } finally {
      setReportDownloading(false);
    }
  }, [currentSessionId, getState]);

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

  // ---- loading state ----
  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!agent) return <div style={{ textAlign: 'center', padding: 40 }}>智能体未找到</div>;

  // ---- render ----
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', gap: 0 }}>
      {/* Left sidebar */}
      <ChatSessionSidebar
        agent={agent}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onRefreshSessions={() => setSidebarRefreshKey((k) => k + 1)}
      />

      {/* Main chat area — matches Vue's el-main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0 }}>
        {/* Messages area — matches Vue's chat-container */}
        <div
          ref={chatContainerRef}
          className="chat-container"
          style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#f8f9fa', borderRadius: 8, marginBottom: 20 }}
        >
          {/* Empty state */}
          {!currentSessionId && !sessionState?.isStreaming && messages.length === 0 && (
            <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '40px 20px' }}>
              <Title level={5} type="secondary">请选择一个会话或创建新会话开始对话</Title>
              {agent.id && <PresetQuestions agentId={agent.id} onQuestionClick={handlePresetQuestionClick} />}
            </div>
          )}

          {/* Messages */}
          {currentSessionId && (
            <div className="messages-area" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {messages.map((msg) => {
                // Report messages with header
                if (msg.messageType === 'markdown-report') {
                  return (
                    <div key={msg.id} className="markdown-report-message" style={{
                      background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: 16, marginBottom: 16,
                    }}>
                      <div className="markdown-report-header" style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0f0',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#409eff', fontSize: 16, fontWeight: 500 }}>
                          <span>报告已生成</span>
                          <Radio.Group
                            value={reportFormat}
                            onChange={(e) => setReportFormat(e.target.value)}
                            size="small"
                            optionType="button"
                            buttonStyle="solid"
                          >
                            <Radio.Button value="markdown">Markdown</Radio.Button>
                            <Radio.Button value="html">HTML</Radio.Button>
                          </Radio.Group>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button size="small" type="primary" icon={<DownloadOutlined />}
                            onClick={() => handleDownloadMarkdown(msg.content)}>
                            下载Markdown报告
                          </Button>
                          <Button size="small" icon={<DownloadOutlined />}
                            onClick={() => handleDownloadHtml(msg.content)}>
                            下载HTML报告
                          </Button>
                          <Tooltip title="全屏查看报告">
                            <Button size="small" icon={<FullscreenOutlined />}
                              onClick={() => openFullscreen(msg.content)}>
                              全屏
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                      <div className="markdown-report-content">
                        <div className="html-rendered-content"
                          dangerouslySetInnerHTML={{ __html: mdRef.current.render(msg.content) }}
                        />
                      </div>
                    </div>
                  );
                }

                if (msg.messageType === 'html-report') {
                  return (
                    <div key={msg.id} className="markdown-report-message" style={{
                      background: '#fff', border: '1px solid #e8e8e8', borderRadius: 12, padding: 16, marginBottom: 16,
                    }}>
                      <div className="markdown-report-header" style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0f0',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#409eff', fontSize: 16, fontWeight: 500 }}>
                          <span>报告已生成</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button size="small" icon={<DownloadOutlined />}
                            onClick={() => handleDownloadHtml(msg.content)}>
                            下载HTML报告
                          </Button>
                          <Tooltip title="全屏查看报告">
                            <Button size="small" icon={<FullscreenOutlined />}
                              onClick={() => openFullscreen(msg.content)}>
                              全屏
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                      <div className="markdown-report-content">
                        <ReportHtmlView content={msg.content} />
                      </div>
                    </div>
                  );
                }

                if (msg.messageType === 'result-set') {
                  return (
                    <div key={msg.id} className="result-set-message" style={{ width: '100%' }}>
                      {(() => {
                        try {
                          const rd = JSON.parse(msg.content) as ResultData;
                          return <ResultSetDisplay resultData={rd} pageSize={pageSize} />;
                        } catch { return <pre>{msg.content}</pre>; }
                      })()}
                    </div>
                  );
                }

                if (msg.messageType === 'html') {
                  return (
                    <div key={msg.id}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.content) }}
                    />
                  );
                }

                // Text / SQL / other simple types
                const isUser = msg.role === 'user';
                const avatarEl = (
                  <div className="message-avatar" style={{ flexShrink: 0 }}>
                    <Avatar size={32} style={{ background: isUser ? '#1677ff' : '#52c41a' }}>
                      {isUser ? '我' : 'AI'}
                    </Avatar>
                  </div>
                );
                const bubbleCol = (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    <div className="message-text" style={{
                      padding: '12px 16px', borderRadius: 12, lineHeight: 1.5, wordWrap: 'break-word',
                      background: isUser ? '#409eff' : '#fff',
                      color: isUser ? '#fff' : '#303133',
                      border: isUser ? 'none' : '1px solid #e8e8e8',
                    }}
                      dangerouslySetInnerHTML={{
                        __html: msg.messageType === 'text'
                          ? msg.content.replace(/\n/g, '<br>')
                          : msg.content,
                      }}
                    />
                    {isUser && (
                      <span
                        title="设为预设问题"
                        style={{ color: '#999', cursor: 'pointer', fontSize: 10, marginTop: 2, userSelect: 'none' }}
                        onClick={async () => {
                          const q = msg.content;
                          try {
                            const existing = await presetQuestionService.list(agentId);
                            console.log('existing', existing);
                            const list = (existing.data?.data || []) as PresetQuestion[];
                            if (list.some((x) => x.question === q)) {
                              message.warning('该问题已是预设问题');
                              return;
                            }
                            list.push({ question: q, sortOrder: list.length, isActive: true } as PresetQuestion);
                            await presetQuestionService.batchSave(agentId, list as any);
                            message.success('已设为预设问题');
                          } catch {
                            message.error('设置失败');
                          }
                        }}
                      >+</span>
                    )}
                  </div>
                );
                return (
                  <div key={msg.id}
                    className={`message-container ${msg.role}`}
                    style={{ display: 'flex', gap: 12, maxWidth: '100%', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}
                  >
                    {isUser ? <>{bubbleCol}{avatarEl}</> : <>{avatarEl}{bubbleCol}</>}
                  </div>
                );
              })}

              {/* Streaming response */}
              {sessionState?.isStreaming && (sessionState.nodeBlocks || []).length > 0 && (
                <div className="streaming-response" style={{
                  background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: 16,
                }}>
                  <div className="streaming-header" style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #f0f0f0',
                  }}>
                    <LoadingOutlined spin style={{ color: '#409eff' }} />
                    <span style={{ fontWeight: 500, color: '#409eff' }}>智能体正在处理中...</span>
                  </div>
                  <div className="agent-response-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {sessionState.nodeBlocks.map((block, i) => {
                      if (!block || !block.length) return null;
                      const first = block[0];

                      // ReportGeneratorNode with MARK_DOWN — use markdown-it or ReportHtmlView
                      if (first.nodeName === 'ReportGeneratorNode' && first.textType === 'MARK_DOWN') {
                        return (
                          <div key={i} className="agent-response-block" style={{
                            background: '#f8f9fa', border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden',
                          }}>
                            <div className="agent-response-title" style={{
                              background: '#ecf5ff', padding: '12px 16px', fontWeight: 600,
                              color: '#409eff', borderBottom: '1px solid #e8e8e8', fontSize: 14,
                            }}>
                              {first.nodeName}
                            </div>
                            <div className="agent-response-content" style={{ padding: 16, lineHeight: 1.6, minHeight: 40 }}>
                              {reportFormat === 'markdown' ? (
                                <div className="html-rendered-content"
                                  dangerouslySetInnerHTML={{
                                    __html: mdRef.current.render(getMarkdownFromBlock(block)),
                                  }}
                                />
                              ) : (
                                <ReportHtmlView content={getMarkdownFromBlock(block)} />
                              )}
                            </div>
                          </div>
                        );
                      }

                      // RESULT_SET
                      if (first.textType === 'RESULT_SET') {
                        return (
                          <div key={i} className="agent-response-block" style={{
                            background: '#f8f9fa', border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden',
                          }}>
                            <div className="agent-response-title" style={{
                              background: '#ecf5ff', padding: '12px 16px', fontWeight: 600,
                              color: '#409eff', borderBottom: '1px solid #e8e8e8', fontSize: 14,
                            }}>
                              {first.nodeName}
                            </div>
                            <div className="agent-response-content" style={{ padding: 16, lineHeight: 1.6, minHeight: 40 }}>
                              {(() => {
                                try {
                                  const rd = JSON.parse(first.text) as ResultData;
                                  return <ResultSetDisplay resultData={rd} pageSize={pageSize} />;
                                } catch { return null; }
                              })()}
                            </div>
                          </div>
                        );
                      }

                      // Other nodes — use generated HTML
                      return (
                        <div key={i}
                          dangerouslySetInnerHTML={{
                            __html: generateNodeHtml(block, showSqlResults, pageSize),
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Human Feedback — between chat-container and input-area, same as Vue */}
        {sessionState?.showHumanFeedback && (
          <HumanFeedback
            rejectCount={sessionState.rejectCount}
            nodeBlocks={sessionState.nodeBlocks || []}
            onFeedback={handleFeedback}
          />
        )}

        {/* Input area — always visible */}
        <div className="input-area" style={{
          background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e8e8e8',
        }}>
            {/* Collapsible options panel */}
            <div className="input-controls" style={{ marginBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
              <div
                className="input-controls-header"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', cursor: 'pointer', userSelect: 'none', color: '#606266', fontSize: 14 }}
                onClick={() => setInputControlsCollapsed(!inputControlsCollapsed)}
              >
                <span style={{ fontWeight: 500 }}>更多选项</span>
                <Button
                  type="primary"
                  size="small"
                  className={inputControlsCollapsed ? 'collapsed' : ''}
                >
                  <ArrowDownOutlined style={{ transition: 'transform 0.2s', transform: inputControlsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                  {inputControlsCollapsed ? '展开' : '收起'}
                </Button>
              </div>
              {!inputControlsCollapsed && (
                <div className="input-controls-body" style={{ paddingBottom: 12 }}>
                  <div className="switch-group" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                    <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>人工反馈</span>
                      <Tooltip title={nl2sqlOnly ? '该功能在NL2SQL模式下不能使用' : ''}>
                        <Switch
                          checked={humanFeedback}
                          onChange={setHumanFeedback}
                          disabled={nl2sqlOnly || !!sessionState?.isStreaming || !!sessionState?.showHumanFeedback}
                        />
                      </Tooltip>
                    </div>
                    <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>仅NL2SQL</span>
                      <Switch
                        checked={nl2sqlOnly}
                        onChange={handleNl2sqlChange}
                        disabled={!!sessionState?.isStreaming || !!sessionState?.showHumanFeedback}
                      />
                    </div>
                    <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>自动Scroll</span>
                      <Switch checked={autoScroll} onChange={setAutoScroll} />
                    </div>
                    <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>显示SQL结果</span>
                      <Tooltip title="启用本功能会将SQL查询结果存储到DataAgent项目的数据库中，如果数据量较大不建议开启本功能">
                        <Switch
                          checked={showSqlResults}
                          onChange={setShowSqlResults}
                          disabled={!!sessionState?.isStreaming || !!sessionState?.showHumanFeedback}
                        />
                      </Tooltip>
                    </div>
                    <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>每页数量</span>
                      <Select
                        value={pageSize}
                        onChange={setPageSize}
                        disabled={!!sessionState?.isStreaming || !!sessionState?.showHumanFeedback}
                        style={{ width: 80 }}
                        options={[
                          { value: 5, label: '5' },
                          { value: 10, label: '10' },
                          { value: 20, label: '20' },
                          { value: 50, label: '50' },
                          { value: 100, label: '100' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Text input */}
            <div className="input-container" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
              <TextArea
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="请输入您的问题...（Shift+Enter 换行）"
                autoSize={{ minRows: 1, maxRows: 5 }}
                disabled={!!sessionState?.isStreaming || !!sessionState?.showHumanFeedback}
                style={{ flex: 1 }}
              />
              {sessionState?.isStreaming ? (
                <Button
                  danger
                  icon={<StopOutlined />}
                  onClick={handleStop}
                  style={{ width: 48, height: 48, borderRadius: '50%' }}
                />
              ) : (
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => handleSend()}
                  disabled={!!sessionState?.showHumanFeedback}
                  style={{ width: 48, height: 48, borderRadius: '50%' }}
                />
              )}
            </div>
          </div>
      </main>

      {/* Fullscreen report modal */}
      {showFullscreenReport && fullscreenReportContent && (
        <div
          className="report-fullscreen-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowFullscreenReport(false)}
        >
          <div
            className="report-fullscreen-container"
            style={{ width: '100%', maxWidth: 1200, height: '90vh', background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="report-fullscreen-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e8e8e8', background: '#f8f9fa', flexShrink: 0 }}>
              <span className="report-fullscreen-title" style={{ fontSize: 18, fontWeight: 600, color: '#303133' }}>
                {reportFormat === 'markdown' ? 'Markdown 报告' : 'HTML 报告'}
              </span>
              <Button danger shape="circle" icon={<CloseOutlined />}
                onClick={() => setShowFullscreenReport(false)}
              />
            </div>
            <div className="report-fullscreen-content" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {reportFormat === 'markdown' ? (
                <div className="html-rendered-content report-fullscreen-body"
                  dangerouslySetInnerHTML={{
                    __html: mdRef.current.render(fullscreenReportContent),
                  }}
                />
              ) : (
                <ReportHtmlView content={fullscreenReportContent} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentRun;
