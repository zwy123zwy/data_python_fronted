import React, { useState } from 'react';
import { Popover, Tag } from 'antd';
import {
  CaretDownOutlined,
  CaretRightOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { AgentRound as AgentRoundType } from '../../stores/executionStore';
import ToolItem from './ToolItem';

// ========== Round 展示配置 ==========

/** Agent 中文标签 */
const ROUND_LABEL: Record<string, string> = {
  Explorer: '探查数据',
  Analyst: '分析与执行',
  Reporter: '生成报告',
};

/** Round 状态的图标和颜色 */
const STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  done: { color: '#52c41a', icon: '✓' },
  running: { color: '#1677ff', icon: '⟳' },
  partial_failure: { color: '#faad14', icon: '⚠' },
  error: { color: '#ff4d4f', icon: '✕' },
  pending: { color: '#d9d9d9', icon: '○' },
  skipped: { color: '#8c8c8c', icon: '—' },
};

// ========== Props ==========

interface Props {
  round: AgentRoundType;
  isActive: boolean;
  onToggle: () => void;
  onToolClick?: (toolId: string) => void;
}

/**
 * AgentRound — 单个 Agent Round 组件
 *
 * 包含:
 *   RoundHeader — 点击展开/折叠 ToolList, 右侧 ℹ️ 弹出详情 Popover
 *   ToolList   — 展开时显示该 Round 下所有 ToolItem
 *
 * 手风琴模式: 同一时间只有一个 Round 展开 (由父组件 ExecutionDrawer 控制)
 */
const AgentRoundComponent: React.FC<Props> = ({ round, isActive, onToggle, onToolClick }) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const config = STATUS_CONFIG[round.status] || STATUS_CONFIG.pending;
  const label = ROUND_LABEL[round.agentName] || round.agentName;
  const doneCount = round.tools.filter((t) => t.status === 'done').length;

  return (
    <div
      style={{
        border: `1px solid ${isActive ? '#1677ff' : '#e8e8e8'}`,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 12,
        transition: 'border-color 0.2s',
      }}
    >
      {/* ========== RoundHeader ========== */}
      <div
        onClick={onToggle}
        style={{
          padding: '8px 12px',
          background: isActive ? '#e6f4ff' : '#fafafa',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          userSelect: 'none',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {/* 状态图标 */}
        <span style={{ color: config.color }}>{config.icon}</span>

        {/* Round 序号 + 名称 */}
        <span style={{ color: isActive ? '#1677ff' : '#303133' }}>
          Round {round.roundIndex} · {label}
        </span>

        {/* 状态标签 */}
        {round.status === 'running' && (
          <Tag color="processing" style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px' }}>执行中</Tag>
        )}
        {round.status === 'done' && (
          <Tag color="success" style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px' }}>完成</Tag>
        )}
        {round.status === 'partial_failure' && (
          <Tag color="warning" style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px' }}>部分失败</Tag>
        )}
        {round.status === 'error' && (
          <Tag color="error" style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px' }}>失败</Tag>
        )}
        {round.status === 'skipped' && (
          <Tag style={{ marginLeft: 4, fontSize: 11, lineHeight: '18px', color: '#8c8c8c' }}>已跳过</Tag>
        )}

        {/* Tool 完成计数 */}
        {round.tools.length > 0 && (
          <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 400, marginLeft: 'auto', marginRight: 4 }}>
            {doneCount}/{round.tools.length}
          </span>
        )}

        <span style={{ flex: 0 }} />

        {/* ===== 详情 Popover ===== */}
        <Popover
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          trigger="click"
          placement="left"
          title={`${label} 详情`}
          content={
            <div style={{ maxWidth: 360, fontSize: 12 }}>
              <div style={{ marginBottom: 4 }}>
                <strong>状态:</strong> {round.status}
              </div>
              <div style={{ marginBottom: 4 }}>
                <strong>Tool 调用记录:</strong>
                {round.tools.length === 0 && <div style={{ color: '#8c8c8c' }}>无</div>}
                {round.tools.map((t) => (
                  <div key={t.id} style={{ margin: '2px 0' }}>
                    {t.name} — {t.status}
                    {t.finishedAt && t.startedAt && (
                      <span style={{ color: '#8c8c8c' }}> ({t.finishedAt - t.startedAt}ms)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <InfoCircleOutlined
            onClick={(e) => {
              e.stopPropagation();
              setPopoverOpen(true);
            }}
            style={{ fontSize: 14, color: '#bfbfbf', cursor: 'pointer' }}
          />
        </Popover>

        {/* 折叠箭头 */}
        {isActive ? (
          <CaretDownOutlined style={{ fontSize: 12, color: '#bfbfbf' }} />
        ) : (
          <CaretRightOutlined style={{ fontSize: 12, color: '#bfbfbf' }} />
        )}
      </div>

      {/* ========== ToolList (展开时) ========== */}
      {isActive && (
        <div style={{ padding: '4px 8px' }}>
          {round.tools.length === 0 && (
            <div style={{ color: '#8c8c8c', fontSize: 12, padding: '4px 8px' }}>等待中…</div>
          )}
          {round.tools.map((tool) => (
            <ToolItem
              key={tool.id}
              tool={tool}
              onClick={onToolClick ? () => onToolClick(tool.id) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentRoundComponent;
