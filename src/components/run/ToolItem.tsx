import React from 'react';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  MinusCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { ToolCall } from '../../stores/executionStore';

// ========== Tool 名称 → 图标 映射 ==========
const TOOL_ICON: Record<string, string> = {
  search_knowledge: '📚',
  get_schema: '🔍',
  rewrite_query: '✏️',
  find_relations: '🔗',
  text_to_sql: '📝',
  semantic_check: '✅',
  execute_sql: '⚡',
  text_to_python: '🐍',
  run_python: '▶️',
  analyze_result: '📊',
};

// ========== 状态 → 图标组件 映射 ==========
const statusIcon = (status: ToolCall['status']) => {
  const style = { fontSize: 14 };
  switch (status) {
    case 'done':
      return <CheckCircleFilled style={{ ...style, color: '#52c41a' }} />;
    case 'error':
      return <CloseCircleFilled style={{ ...style, color: '#ff4d4f' }} />;
    case 'running':
      return <LoadingOutlined style={{ ...style, color: '#1677ff' }} spin />;
    case 'skipped':
      return <MinusCircleOutlined style={{ ...style, color: '#8c8c8c' }} />;
    default:
      return <ClockCircleOutlined style={{ ...style, color: '#d9d9d9' }} />;
  }
};

interface Props {
  tool: ToolCall;
  onClick?: () => void;
}

/**
 * ToolItem — 单个 Tool 调用条目
 *
 * 展示 tool 名称、图标、状态指示和结果摘要（done/error 时）。
 * 点击可滚动到对话区的思考气泡定位点。
 */
const ToolItem: React.FC<Props> = ({ tool, onClick }) => {
  const { name, status, summary } = tool;

  // 名称文本：running 时加粗蓝色，其余灰色正常
  const nameStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: status === 'running' ? 600 : 400,
    color: status === 'running' ? '#1677ff' : '#595959',
    flex: '0 0 auto',
  };

  // 摘要文本样式
  const summaryStyle: React.CSSProperties = {
    fontSize: 12,
    color: status === 'error' ? '#ff4d4f' : '#8c8c8c',
    maxWidth: 120,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: '1 1 auto',
    minWidth: 0,
  };

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        borderRadius: 6,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (onClick) (e.currentTarget as HTMLDivElement).style.background = '#f5f5f5';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* Tool 图标 */}
      <span style={{ fontSize: 14, flexShrink: 0 }}>
        {TOOL_ICON[name] || '🔧'}
      </span>

      {/* Tool 名称 */}
      <span style={nameStyle}>{name}</span>

      {/* 结果摘要：仅 done / error 时展示 */}
      {(status === 'done' || status === 'error') && summary && (
        <span style={summaryStyle} title={summary}>
          {summary}
        </span>
      )}

      {/* 状态图标 */}
      {statusIcon(status)}
    </div>
  );
};

export default ToolItem;
