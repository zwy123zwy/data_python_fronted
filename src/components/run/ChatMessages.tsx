import React from 'react';
import { Button, Avatar, Typography, Radio, Tooltip, App } from 'antd';
import {
  DownloadOutlined,
  FullscreenOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { presetQuestionService } from '../../services/presetQuestion';
import { generateNodeHtml } from '../../utils/nodeFormat';
import PresetQuestions from './PresetQuestions';
import ResultSetDisplay from './ResultSetDisplay';
import ReportHtmlView from './ReportHtmlView';
import type { ChatMessage, GraphNodeResponse, ResultData, PresetQuestion } from '../../types';

const { Title } = Typography;

interface Props {
  currentSessionId: string;
  messages: ChatMessage[];
  nodeBlocks: GraphNodeResponse[][];
  reportFormat: 'markdown' | 'html';
  onReportFormatChange: (v: 'markdown' | 'html') => void;
  pageSize: number;
  showSqlResults: boolean;
  agentId: number;
  mdRef: React.MutableRefObject<MarkdownIt>;
  onDownloadMarkdown: (content: string) => void;
  onDownloadHtml: (content?: string) => void;
  onOpenFullscreen: (content: string) => void;
  onGetMarkdownFromBlock: (nodes: GraphNodeResponse[]) => string;
  onPresetQuestionClick: (question: string) => void;
  isStreaming: boolean;
}

const ChatMessages: React.FC<Props> = ({
  currentSessionId,
  messages,
  nodeBlocks,
  reportFormat,
  onReportFormatChange,
  pageSize,
  showSqlResults,
  agentId,
  mdRef,
  onDownloadMarkdown,
  onDownloadHtml,
  onOpenFullscreen,
  onGetMarkdownFromBlock,
  onPresetQuestionClick,
  isStreaming,
}) => {
  const { message } = App.useApp();

  const isEmpty = !currentSessionId && !isStreaming && messages.length === 0;

  return (
    <>
      {/* Empty state */}
      {isEmpty && (
        <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '40px 20px' }}>
          <Title level={5} type="secondary">请选择一个会话或创建新会话开始对话</Title>
          {agentId && <PresetQuestions agentId={agentId} onQuestionClick={onPresetQuestionClick} />}
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
                        onChange={(e) => onReportFormatChange(e.target.value)}
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
                        onClick={() => onDownloadMarkdown(msg.content)}>
                        下载Markdown报告
                      </Button>
                      <Button size="small" icon={<DownloadOutlined />}
                        onClick={() => onDownloadHtml(msg.content)}>
                        下载HTML报告
                      </Button>
                      <Tooltip title="全屏查看报告">
                        <Button size="small" icon={<FullscreenOutlined />}
                          onClick={() => onOpenFullscreen(msg.content)}>
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
                        onClick={() => onDownloadHtml(msg.content)}>
                        下载HTML报告
                      </Button>
                      <Tooltip title="全屏查看报告">
                        <Button size="small" icon={<FullscreenOutlined />}
                          onClick={() => onOpenFullscreen(msg.content)}>
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
          {isStreaming && nodeBlocks.length > 0 && (
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
                {nodeBlocks.map((block, i) => {
                  if (!block || !block.length) return null;
                  const first = block[0];

                  // ReportGeneratorNode with MARK_DOWN
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
                                __html: mdRef.current.render(onGetMarkdownFromBlock(block)),
                              }}
                            />
                          ) : (
                            <ReportHtmlView content={onGetMarkdownFromBlock(block)} />
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
    </>
  );
};

export default ChatMessages;
