import React from 'react';
import { Button, Avatar, Typography, Radio, Tooltip, App } from 'antd';
import {
  DownloadOutlined,
  FullscreenOutlined,
} from '@ant-design/icons';
import DOMPurify from 'dompurify';
import MarkdownIt from 'markdown-it';
import { presetQuestionService } from '../../services/presetQuestion';
import PresetQuestions from './PresetQuestions';
import ChainOfThought from './ChainOfThought';
import V2ThinkingTimeline from './V2ThinkingTimeline';
import type { V2TimelineEntry } from '../../types/v2Timeline';
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
  streamingAssistantText?: string;
  streamingTextType?: string;
  /** [阶段5] V2 思考时间线（合并 Gateway + 工具步骤） */
  v2Timeline?: V2TimelineEntry[];
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
  streamingAssistantText = '',
  streamingTextType = 'TEXT',
  v2Timeline = [],
}) => {
  const { message } = App.useApp();

  const isEmpty = !currentSessionId && !isStreaming && messages.length === 0;

  // [阶段5] 本轮助手回复须在思考时间线之后，避免落库后思考区跑到结果下方
  const hasV2Timeline = v2Timeline.length > 0;
  let turnAssistant: ChatMessage | null = null;
  if (hasV2Timeline && !isStreaming && messages.length > 0) {
    const last = messages[messages.length - 1];
    if (last.role === 'assistant') {
      turnAssistant = last;
    }
  }
  const skipMessageId = turnAssistant?.id;

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
            if (skipMessageId && msg.id === skipMessageId) return null;

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
                        const list: { question: string; sortOrder: number; isActive: number }[] = (existing.data?.data || []).map((x: PresetQuestion) => ({ question: x.question, sortOrder: x.sortOrder, isActive: x.isActive ? 1 : 0 }));
                        if (list.some((x) => x.question === q)) {
                          message.warning('该问题已是预设问题');
                          return;
                        }
                        list.push({ question: q, sortOrder: list.length, isActive: 1 });
                        await presetQuestionService.batchSave(agentId, list);
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

          {/* [阶段5] V2 思考时间线（始终在当轮结果气泡之上） */}
          {hasV2Timeline && (
            <V2ThinkingTimeline
              entries={v2Timeline}
              isStreaming={isStreaming}
              pageSize={pageSize}
            />
          )}

          {/* 中间产物：SQL / 结果表（在最终文字回复之前） */}
          {nodeBlocks.length > 0 && (
            <ChainOfThought
              nodeBlocks={nodeBlocks}
              isStreaming={isStreaming}
              showSqlResults={showSqlResults}
              pageSize={pageSize}
              reportFormat={reportFormat}
              mdRef={mdRef}
              onGetMarkdownFromBlock={onGetMarkdownFromBlock}
            />
          )}

          {/* [阶段5] LLM 逐字流式气泡 */}
          {isStreaming && (
            <div
              className="message-container assistant streaming-reply"
              style={{
                display: 'flex',
                gap: 12,
                maxWidth: '100%',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
              }}
            >
              <div className="message-avatar" style={{ flexShrink: 0 }}>
                <Avatar size={32} style={{ background: '#52c41a' }}>AI</Avatar>
              </div>
              <div
                className="message-text streaming-text"
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  lineHeight: 1.6,
                  maxWidth: '80%',
                  minHeight: 40,
                  background: '#fff',
                  border: '1px solid #e8e8e8',
                  color: '#303133',
                }}
              >
                {streamingAssistantText ? (
                  /* 流式阶段用纯文本，避免每字重跑 markdown 导致突变 */
                  <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {streamingAssistantText}
                  </span>
                ) : (
                  <span style={{ color: '#909399' }}>正在回复…</span>
                )}
              </div>
            </div>
          )}

          {!isStreaming && turnAssistant && (() => {
            const msg = turnAssistant;
            const avatarEl = (
              <div className="message-avatar" style={{ flexShrink: 0 }}>
                <Avatar size={32} style={{ background: '#52c41a' }}>AI</Avatar>
              </div>
            );
            const bubbleCol = (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '80%' }}>
                <div
                  className="message-text"
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    lineHeight: 1.5,
                    wordWrap: 'break-word',
                    background: '#fff',
                    color: '#303133',
                    border: '1px solid #e8e8e8',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: msg.messageType === 'text'
                      ? msg.content.replace(/\n/g, '<br>')
                      : msg.content,
                  }}
                />
              </div>
            );
            return (
              <div
                key={msg.id}
                className="message-container assistant turn-reply"
                style={{
                  display: 'flex',
                  gap: 12,
                  maxWidth: '100%',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                }}
              >
                {avatarEl}
                {bubbleCol}
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
};

export default ChatMessages;
