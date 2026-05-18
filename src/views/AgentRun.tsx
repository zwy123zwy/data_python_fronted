import React, { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Input, Switch, Spin, Select, Tooltip } from 'antd';
import {
  SendOutlined,
  StopOutlined,
  ArrowDownOutlined,
  CloseOutlined,
  ControlOutlined,
} from '@ant-design/icons';
import { createMarkdownIt } from '../components/run/markdown';
import ChatSessionSidebar from '../components/run/ChatSessionSidebar';
import ChatMessages from '../components/run/ChatMessages';
import HumanFeedback from '../components/run/HumanFeedback';
import ReportHtmlView from '../components/run/ReportHtmlView';
import ExecutionDrawer from '../components/run/ExecutionDrawer';
import ThinkingBubble from '../components/run/ThinkingBubble';
import { useExecutionStore } from '../stores/executionStore';
import { useAgentChat } from '../hooks/useAgentChat';

const { TextArea } = Input;

/**
 * AgentRun — 智能体对话运行页面（对齐 Vue 版 AgentRun.vue）
 *
 * 页面布局：左侧会话列表 + 右侧聊天区（消息 / 人机反馈 / 输入框）+ 全屏报告弹窗
 * 所有业务逻辑委托给 useAgentChat hook，本组件只负责布局编排
 */
const AgentRun: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const agentId = Number(id);

  // 单一 hook 管理全部聊天状态与操作
  const chat = useAgentChat(agentId);
  // 执行面板状态 (抽屉、Round、Tool、思考气泡)
  const execStore = useExecutionStore();

  // markdown-it 实例（带 ECharts 插件），仅创建一次
  const mdRef = useRef(createMarkdownIt());

  // ---- 加载中 / 智能体不存在 ----
  if (chat.loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!chat.agent) return <div style={{ textAlign: 'center', padding: 40 }}>智能体未找到</div>;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', gap: 0 }}>
      {/* ==================== 左侧：会话列表侧边栏 ==================== */}
      <ChatSessionSidebar
        agent={chat.agent}
        currentSessionId={chat.currentSessionId}
        onSelectSession={chat.handleSelectSession}
        refreshKey={chat.sidebarRefreshKey}
      />

      {/* ==================== 右侧：主聊天区域 ==================== */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0 }}>
        {/* ---- 消息列表 + 流式渲染 ---- */}
        <div
          ref={chat.chatContainerRef}
          className="chat-container"
          style={{ flex: 1, overflowY: 'auto', padding: 20, background: '#f8f9fa', borderRadius: 8, marginBottom: 20 }}
        >
          {/* ★ 执行面板切换按钮 (抽屉关闭时可见) */}
          {!execStore.drawerVisible && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <Button
                size="small"
                icon={<ControlOutlined />}
                onClick={() => execStore.openDrawer()}
              >
                执行过程 ▸
              </Button>
            </div>
          )}

          {/* ★ 思考气泡 (单例: 内容随执行节点刷新) */}
          <ThinkingBubble />

          <ChatMessages
            currentSessionId={chat.currentSessionId}
            messages={chat.messages}
            nodeBlocks={chat.sessionState?.nodeBlocks || []}
            reportFormat={chat.reportFormat}
            onReportFormatChange={chat.setReportFormat}
            pageSize={chat.pageSize}
            showSqlResults={chat.showSqlResults}
            agentId={chat.agent.id}
            mdRef={mdRef}
            onDownloadMarkdown={chat.handleDownloadMarkdown}
            onDownloadHtml={chat.handleDownloadHtml}
            onOpenFullscreen={chat.openFullscreen}
            onGetMarkdownFromBlock={chat.getMarkdownFromBlock}
            onPresetQuestionClick={chat.handlePresetQuestionClick}
            isStreaming={chat.sessionState?.isStreaming || false}
          />
        </div>

        {/* ---- 人机回路反馈面板（SSE 暂停时显示） ---- */}
        {chat.sessionState?.showHumanFeedback && (
          <HumanFeedback
            rejectCount={chat.sessionState.rejectCount}
            nodeBlocks={chat.sessionState.nodeBlocks || []}
            onFeedback={chat.handleFeedback}
          />
        )}

        {/* ---- 底部输入区域 ---- */}
        <div className="input-area" style={{
          background: '#fff', borderRadius: 8, padding: 16, border: '1px solid #e8e8e8',
        }}>
          {/* 可折叠的更多选项面板 */}
          <div className="input-controls" style={{ marginBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
            <div
              className="input-controls-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', cursor: 'pointer', userSelect: 'none', color: '#606266', fontSize: 14 }}
              onClick={() => chat.setInputControlsCollapsed(!chat.inputControlsCollapsed)}
            >
              <span style={{ fontWeight: 500 }}>更多选项</span>
              <Button
                type="primary"
                size="small"
                className={chat.inputControlsCollapsed ? 'collapsed' : ''}
              >
                <ArrowDownOutlined style={{ transition: 'transform 0.2s', transform: chat.inputControlsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                {chat.inputControlsCollapsed ? '展开' : '收起'}
              </Button>
            </div>
            {/* 选项开关组：人工反馈 / 仅 NL2SQL / 自动滚动 / 显示 SQL 结果 / 每页数量 */}
            {!chat.inputControlsCollapsed && (
              <div className="input-controls-body" style={{ paddingBottom: 12 }}>
                <div className="switch-group" style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center' }}>
                  {/* 人工反馈开关 */}
                  <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>人工反馈</span>
                    <Tooltip title={chat.nl2sqlOnly ? '该功能在NL2SQL模式下不能使用' : ''}>
                      <Switch
                        checked={chat.humanFeedback}
                        onChange={chat.setHumanFeedback}
                        disabled={chat.nl2sqlOnly || !!chat.sessionState?.isStreaming || !!chat.sessionState?.showHumanFeedback}
                      />
                    </Tooltip>
                  </div>
                  {/* 仅 NL2SQL 开关 */}
                  <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>仅NL2SQL</span>
                    <Switch
                      checked={chat.nl2sqlOnly}
                      onChange={chat.handleNl2sqlChange}
                      disabled={!!chat.sessionState?.isStreaming || !!chat.sessionState?.showHumanFeedback}
                    />
                  </div>
                  {/* 自动滚动开关 */}
                  <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>自动Scroll</span>
                    <Switch checked={chat.autoScroll} onChange={chat.setAutoScroll} />
                  </div>
                  {/* 显示 SQL 结果开关 */}
                  <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>显示SQL结果</span>
                    <Tooltip title="启用本功能会将SQL查询结果存储到DataAgent项目的数据库中，如果数据量较大不建议开启本功能">
                      <Switch
                        checked={chat.showSqlResults}
                        onChange={chat.setShowSqlResults}
                        disabled={!!chat.sessionState?.isStreaming || !!chat.sessionState?.showHumanFeedback}
                      />
                    </Tooltip>
                  </div>
                  {/* 每页数量选择器 */}
                  <div className="switch-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="switch-label" style={{ fontSize: 14, color: '#606266' }}>每页数量</span>
                    <Select
                      value={chat.pageSize}
                      onChange={chat.setPageSize}
                      disabled={!!chat.sessionState?.isStreaming || !!chat.sessionState?.showHumanFeedback}
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

          {/* 文本输入 + 发送 / 停止按钮 */}
          <div className="input-container" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <TextArea
              value={chat.inputQuery}
              onChange={(e) => chat.setInputQuery(e.target.value)}
              onPressEnter={(e) => {
                // Enter 发送，Shift+Enter 换行
                if (!e.shiftKey) {
                  e.preventDefault();
                  chat.handleSend();
                }
              }}
              placeholder="请输入您的问题...（Shift+Enter 换行）"
              autoSize={{ minRows: 1, maxRows: 5 }}
              disabled={!!chat.sessionState?.isStreaming || !!chat.sessionState?.showHumanFeedback}
              style={{ flex: 1 }}
            />
            {/* 流式进行中显示停止按钮，否则显示发送按钮 */}
            {chat.sessionState?.isStreaming ? (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={chat.handleStop}
                style={{ width: 48, height: 48, borderRadius: '50%' }}
              />
            ) : (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => chat.handleSend()}
                disabled={!!chat.sessionState?.showHumanFeedback}
                style={{ width: 48, height: 48, borderRadius: '50%' }}
              />
            )}
          </div>
        </div>
      </main>

      {/* ==================== 右侧：执行面板 (360px 抽屉) ==================== */}
      <ExecutionDrawer />

      {/* ==================== 全屏报告弹窗 ==================== */}
      {chat.showFullscreenReport && chat.fullscreenReportContent && (
        <div
          className="report-fullscreen-overlay"
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => chat.setShowFullscreenReport(false)}
        >
          <div
            className="report-fullscreen-container"
            style={{ width: '100%', maxWidth: 1200, height: '90vh', background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题栏 */}
            <div className="report-fullscreen-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid #e8e8e8', background: '#f8f9fa', flexShrink: 0 }}>
              <span className="report-fullscreen-title" style={{ fontSize: 18, fontWeight: 600, color: '#303133' }}>
                {chat.reportFormat === 'markdown' ? 'Markdown 报告' : 'HTML 报告'}
              </span>
              <Button danger shape="circle" icon={<CloseOutlined />}
                onClick={() => chat.setShowFullscreenReport(false)}
              />
            </div>
            {/* 弹窗内容：Markdown 渲染 或 HTML 沙箱 */}
            <div className="report-fullscreen-content" style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              {chat.reportFormat === 'markdown' ? (
                <div className="html-rendered-content report-fullscreen-body"
                  dangerouslySetInnerHTML={{
                    __html: mdRef.current.render(chat.fullscreenReportContent),
                  }}
                />
              ) : (
                <ReportHtmlView content={chat.fullscreenReportContent} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentRun;
