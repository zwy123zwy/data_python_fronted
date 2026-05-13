import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, Switch, Space, Layout, Spin, Typography, message } from 'antd';
import { SendOutlined, StopOutlined, DownloadOutlined, ArrowLeftOutlined, FullscreenOutlined } from '@ant-design/icons';
import { agentService } from '../services/agent';
import { chatService } from '../services/chat';
import { streamSearch } from '../services/graph';
import { useSessionStateStore } from '../stores/sessionStateStore';
import ChatSessionSidebar from '../components/run/ChatSessionSidebar';
import HumanFeedback from '../components/run/HumanFeedback';
import PresetQuestions from '../components/run/PresetQuestions';
import ResultSetDisplay from '../components/run/ResultSetDisplay';
import ReportHtmlView from '../components/run/ReportHtmlView';
import 'highlight.js/styles/atom-one-light.css';
import type { Agent, ChatSession, ChatMessage, GraphNodeResponse, GraphRequest, ResultData } from '../types';

const { Text, Title } = Typography;
const { TextArea } = Input;

const AgentRun: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const agentId = Number(id);

  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [humanFeedback, setHumanFeedback] = useState(false);
  const [nl2sqlOnly, setNl2sqlOnly] = useState(false);
  const [pageSize] = useState(100);
  const [showFullscreenReport, setShowFullscreenReport] = useState(false);
  const [reportDownloading, setReportDownloading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const { getState, setState } = useSessionStateStore();
  const sessionState = currentSessionId ? getState(currentSessionId) : null;

  // Load agent
  useEffect(() => {
    agentService.get(agentId).then((res) => {
      setAgent(res.data.data || null);
    }).catch(() => {
      message.error('加载智能体失败');
    }).finally(() => setLoading(false));
  }, [agentId]);

  // Auto-scroll
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, sessionState?.nodeBlocks]);

  const handleSelectSession = useCallback(async (session: ChatSession) => {
    if (!session.id) return;
    setCurrentSessionId(session.id);
    // Load history
    try {
      const res = await chatService.getSessionMessages(session.id);
      setMessages((res.data.data || []) as ChatMessage[]);
    } catch {
      setMessages([]);
    }
  }, []);

  const handleSaveMessage = useCallback(async (sessionId: string, msg: {
    role: 'user' | 'assistant';
    content: string;
    messageType: string;
    metadata?: Record<string, unknown>;
    titleNeeded?: boolean;
  }) => {
    try {
      const res = await chatService.saveMessage(sessionId, msg as Parameters<typeof chatService.saveMessage>[1]);
      return res.data.data as ChatMessage;
    } catch {
      return null;
    }
  }, []);

  const handleSend = useCallback(async (queryText?: string) => {
    const query = queryText || inputQuery;
    if (!query.trim() || !agentId) return;
    setInputQuery('');

    // Get or create session
    let sid = currentSessionId;
    if (!sid) {
      try {
        const res = await chatService.createSession(agentId, { title: 'New Chat', userId: 'default' });
        const session = res.data.data as ChatSession;
        if (session) {
          sid = session.id;
          setCurrentSessionId(sid);
        }
      } catch {
        message.error('创建会话失败');
        return;
      }
    }

    // Save user message
    const userMsg = {
      role: 'user' as const,
      content: query,
      messageType: 'text',
      metadata: { titleNeeded: messages.length === 0 },
    };
    const savedUser = await handleSaveMessage(sid, userMsg);
    const displayUser: ChatMessage = {
      id: savedUser?.id || String(Date.now()),
      sessionId: sid,
      role: 'user',
      content: query,
      messageType: 'text',
      createTime: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, displayUser]);

    // Initialize session state
    setState(sid, {
      isStreaming: true,
      nodeBlocks: [],
      closeStream: null,
      showHumanFeedback: false,
      rejectCount: 0,
      currentThreadId: '',
      htmlReportContent: null,
      markdownReportContent: null,
      htmlReportSize: 0,
      lastRequest: { agentId, query, humanFeedback, rejectedPlan: false, nl2sqlOnly },
    });

    const request: GraphRequest = {
      agentId,
      query,
      humanFeedback,
      rejectedPlan: false,
      nl2sqlOnly,
    };

    const closeFn = streamSearch(request, {
      onMessage: (data: GraphNodeResponse) => {
        setState(sid, {
          nodeBlocks: [...(getState(sid).nodeBlocks || []), [data]],
          currentThreadId: data.threadId,
        });

        // Collect report content
        if (data.textType === 'HTML') {
          const current = getState(sid);
          setState(sid, { htmlReportContent: (current.htmlReportContent || '') + data.text });
        }
        if (data.textType === 'MARK_DOWN') {
          const current = getState(sid);
          setState(sid, { markdownReportContent: (current.markdownReportContent || '') + data.text });
        }
      },
      onError: (error: string) => {
        message.error(error);
        setState(sid, { isStreaming: false });
      },
      onComplete: () => {
        setState(sid, { isStreaming: false });
        // Save assistant messages
        const state = getState(sid);
        if (state.markdownReportContent) {
          handleSaveMessage(sid, {
            role: 'assistant', content: state.markdownReportContent,
            messageType: 'markdown-report', metadata: {},
          });
        }
        if (state.htmlReportContent) {
          handleSaveMessage(sid, {
            role: 'assistant', content: state.htmlReportContent,
            messageType: 'html-report', metadata: {},
          });
        }
      },
      onPaused: (threadId: string) => {
        const state = getState(sid);
        setState(sid, {
          isStreaming: false,
          showHumanFeedback: true,
          currentThreadId: threadId || state.currentThreadId,
        });
      },
    });

    setState(sid, { closeStream: closeFn });
  }, [inputQuery, agentId, currentSessionId, messages.length, humanFeedback, nl2sqlOnly, getState, setState, handleSaveMessage]);

  const handleStop = useCallback(() => {
    const state = currentSessionId ? getState(currentSessionId) : null;
    state?.closeStream?.();
    if (currentSessionId) {
      setState(currentSessionId, { isStreaming: false, closeStream: null });
    }
  }, [currentSessionId, getState, setState]);

  const handleFeedback = useCallback(async (approved: boolean, feedbackContent: string) => {
    const state = currentSessionId ? getState(currentSessionId) : null;
    if (!state || !currentSessionId) return;

    setState(currentSessionId, { showHumanFeedback: false, isStreaming: true, nodeBlocks: [] });

    const request: GraphRequest = {
      agentId,
      threadId: state.currentThreadId,
      query: state.lastRequest?.query || '',
      humanFeedback: true,
      humanFeedbackContent: feedbackContent,
      rejectedPlan: !approved,
      nl2sqlOnly: state.lastRequest?.nl2sqlOnly || false,
    };

    const closeFn = streamSearch(request, {
      onMessage: (data: GraphNodeResponse) => {
        setState(currentSessionId, {
          nodeBlocks: [...(getState(currentSessionId).nodeBlocks || []), [data]],
          currentThreadId: data.threadId,
        });
      },
      onError: (error: string) => {
        message.error(error);
        setState(currentSessionId, { isStreaming: false });
      },
      onComplete: () => {
        setState(currentSessionId, { isStreaming: false });
        const st = getState(currentSessionId);
        if (st.markdownReportContent) {
          handleSaveMessage(currentSessionId, { role: 'assistant', content: st.markdownReportContent, messageType: 'markdown-report', metadata: {} });
        }
        if (st.htmlReportContent) {
          handleSaveMessage(currentSessionId, { role: 'assistant', content: st.htmlReportContent, messageType: 'html-report', metadata: {} });
        }
      },
      onPaused: (threadId: string) => {
        const st = getState(currentSessionId);
        setState(currentSessionId, {
          isStreaming: false,
          showHumanFeedback: true,
          currentThreadId: threadId || st.currentThreadId,
          rejectCount: approved ? st.rejectCount : st.rejectCount + 1,
        });
      },
    });

    setState(currentSessionId, { closeStream: closeFn });
  }, [agentId, currentSessionId, getState, setState, handleSaveMessage]);

  const handleDownloadReport = async () => {
    if (!currentSessionId) return;
    setReportDownloading(true);
    try {
      const res = await chatService.downloadHtmlReport(currentSessionId);
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${currentSessionId}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      message.error('下载失败');
    } finally {
      setReportDownloading(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!agent) return <div>智能体未找到</div>;

  // Parse result sets from node blocks
  const resultSets: ResultData[] = (sessionState?.nodeBlocks || [])
    .flat()
    .filter((n: GraphNodeResponse) => n.textType === 'RESULT_SET')
    .map((n: GraphNodeResponse) => {
      try { return JSON.parse(n.text) as ResultData; }
      catch { return null; }
    })
    .filter(Boolean) as ResultData[];

  const hasReport = !!(sessionState?.htmlReportContent || sessionState?.markdownReportContent);

  return (
    <Layout style={{ height: 'calc(100vh - 56px)' }}>
      {/* Sidebar */}
      <ChatSessionSidebar
        agent={agent}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onRefreshSessions={() => {}}
      />

      {/* Main chat area */}
      <Layout.Content style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #f0f0f0', gap: 12, flexWrap: 'wrap' }}>
          <Button icon={<ArrowLeftOutlined />} size="small" onClick={() => navigate(`/agent/${agentId}`)}>返回</Button>
          <Text strong>{agent.name}</Text>
          <Space size={4}>
            <Text style={{ fontSize: 11 }}>仅 NL2SQL</Text>
            <Switch size="small" checked={nl2sqlOnly} onChange={setNl2sqlOnly} />
          </Space>
          <Space size={4}>
            <Text style={{ fontSize: 11 }}>人工审核</Text>
            <Switch size="small" checked={humanFeedback} onChange={setHumanFeedback} />
          </Space>
          {hasReport && (
            <>
              <Button size="small" icon={<FullscreenOutlined />} onClick={() => setShowFullscreenReport(true)}>全屏报告</Button>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadReport} loading={reportDownloading}>下载</Button>
            </>
          )}
        </div>

        {/* Messages */}
        <div
          ref={messagesRef}
          style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {!currentSessionId && !sessionState?.isStreaming && messages.length === 0 && (
            <div style={{ textAlign: 'center', margin: 'auto', color: '#999' }}>
              <Title level={5} type="secondary">选择或创建会话开始对话</Title>
              {agent.id && <PresetQuestions agentId={agent.id} onQuestionClick={(q) => { setInputQuery(q); }} />}
            </div>
          )}

          {/* History messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {/* Render based on messageType */}
                {msg.messageType === 'text' && msg.content}
                {msg.messageType === 'sql' && (
                  <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 13 }}><code>{msg.content}</code></pre>
                )}
                {msg.messageType === 'result-set' && (() => {
                  try {
                    const rd = JSON.parse(msg.content) as ResultData;
                    return <ResultSetDisplay resultData={rd} pageSize={pageSize} />;
                  } catch { return <pre>{msg.content}</pre>; }
                })()}
                {(msg.messageType === 'html-report' || msg.messageType === 'html') && (
                  <ReportHtmlView content={msg.content} />
                )}
                {msg.messageType === 'markdown-report' && (
                  <div className="html-rendered-content" dangerouslySetInnerHTML={{ __html: msg.content }} />
                )}
              </div>
            </div>
          ))}

          {/* Streaming node blocks */}
          {sessionState?.isStreaming && (sessionState.nodeBlocks || []).map((block, i) => (
            <div key={i} className="agent-response-block">
              {block.map((node, j) => (
                <div key={j}>
                  <div className="agent-response-title">{node.nodeName}</div>
                  <div className="agent-response-content">
                    {node.textType === 'SQL' && (
                      <pre><code className="language-sql" dangerouslySetInnerHTML={{ __html: node.text }} /></pre>
                    )}
                    {node.textType === 'PYTHON' && (
                      <pre><code className="language-python">{node.text}</code></pre>
                    )}
                    {node.textType === 'JSON' && (
                      <pre><code>{(() => { try { return JSON.stringify(JSON.parse(node.text), null, 2); } catch { return node.text; } })()}</code></pre>
                    )}
                    {node.textType === 'RESULT_SET' && (() => {
                      try {
                        const rd = JSON.parse(node.text) as ResultData;
                        return <ResultSetDisplay resultData={rd} pageSize={pageSize} />;
                      } catch { return node.text; }
                    })()}
                    {node.textType === 'MARK_DOWN' && (
                      <div className="html-rendered-content" dangerouslySetInnerHTML={{ __html: node.text }} />
                    )}
                    {node.textType === 'HTML' && (
                      <ReportHtmlView content={node.text} />
                    )}
                    {node.textType === 'TEXT' && (
                      <span>{node.text}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Human Feedback */}
          {sessionState?.showHumanFeedback && (
            <HumanFeedback
              rejectCount={sessionState.rejectCount}
              nodeBlocks={sessionState.nodeBlocks || []}
              onFeedback={handleFeedback}
            />
          )}
        </div>

        {/* Input area */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #f0f0f0' }}>
          <PresetQuestions agentId={agent.id} onQuestionClick={(q) => handleSend(q)} />
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入查询内容...（Shift+Enter 换行）"
              autoSize={{ minRows: 1, maxRows: 5 }}
              disabled={sessionState?.isStreaming}
              style={{ flex: 1 }}
            />
            {sessionState?.isStreaming ? (
              <Button danger icon={<StopOutlined />} onClick={handleStop}>停止</Button>
            ) : (
              <Button type="primary" icon={<SendOutlined />} onClick={() => handleSend()}>发送</Button>
            )}
          </Space.Compact>
        </div>

        {/* Fullscreen report modal */}
        {showFullscreenReport && (sessionState?.htmlReportContent || sessionState?.markdownReportContent) && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#fff', zIndex: 2000,
            overflow: 'auto', padding: 24,
          }}>
            <Button style={{ position: 'fixed', top: 16, right: 16, zIndex: 2001 }} onClick={() => setShowFullscreenReport(false)}>关闭</Button>
            {sessionState.htmlReportContent ? (
              <ReportHtmlView content={sessionState.htmlReportContent} />
            ) : (
              <div className="html-rendered-content" dangerouslySetInnerHTML={{ __html: sessionState.markdownReportContent || '' }} />
            )}
          </div>
        )}
      </Layout.Content>

      {/* Result sets at bottom */}
      {resultSets.length > 0 && (
        <div style={{ borderTop: '1px solid #f0f0f0', padding: 12, maxHeight: 300, overflowY: 'auto' }}>
          {resultSets.map((rd, i) => (
            <ResultSetDisplay key={i} resultData={rd} pageSize={pageSize} />
          ))}
        </div>
      )}
    </Layout>
  );
};

export default AgentRun;
