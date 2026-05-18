import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useExecutionStore } from '../../stores/executionStore';
import AgentRoundComponent from './AgentRound';

/**
 * ExecutionDrawer — 右侧执行面板 (360px 抽屉)
 *
 * 生命周期:
 *   - 执行开始时从右侧滑入 (drawerVisible 由 streamRequest 中首个 visible node 触发)
 *   - 用户点击 ✕ 手动关闭
 *   - 全部 Round done 时顶部显示 "✓ 执行完成" 提示
 *
 * 手风琴: 同一时间只有一个 Round 展开
 *   - 默认展开执行中的 Round
 *   - 用户手动切换后跟随用户操作 (expandedRoundId 为 null 表示已手动关闭)
 */
const ExecutionDrawer: React.FC = () => {
  const drawerVisible = useExecutionStore((s) => s.drawerVisible);
  const rounds = useExecutionStore((s) => s.rounds);
  const closeDrawer = useExecutionStore((s) => s.closeDrawer);

  // 手风琴: undefined=自动模式(null=手动关闭, string=手动展开)
  const [expandedRoundId, setExpandedRoundId] = useState<string | null | undefined>(undefined);

  const allDone = rounds.length > 0 && rounds.every((r) => r.status === 'done');
  const doneCount = rounds.filter((r) => r.status === 'done').length;

  // 执行中的 Round 自动展开 (仅 expandedRoundId 为 undefined 时)
  const runningRoundId = rounds.find((r) => r.status === 'running')?.id;
  const effectiveExpanded = expandedRoundId !== undefined ? expandedRoundId : runningRoundId;

  // 新执行开始时重置手风琴状态
  useEffect(() => {
    if (rounds.length === 0) {
      setExpandedRoundId(undefined);
    }
  }, [rounds.length]);

  const handleToggle = (roundId: string) => {
    setExpandedRoundId((prev) => (prev === roundId ? null : roundId));
  };

  // 点击 tool → 对话区滚动到思考气泡 (data-thinking-bubble)
  const handleToolClick = (_toolId: string) => {
    const el = document.querySelector('[data-thinking-bubble]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div
      style={{
        width: drawerVisible ? 360 : 0,
        minWidth: drawerVisible ? 360 : 0,
        borderLeft: drawerVisible ? '1px solid #e8e8e8' : 'none',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        overflow: 'hidden',
        transition: 'width 0.3s ease, min-width 0.3s ease',
      }}
    >
      {/* ===== Header ===== */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #e8e8e8',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontWeight: 600,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        <span>⚙️ 执行过程</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rounds.length > 0 && (
            <span style={{ fontSize: 11, color: '#8c8c8c', fontWeight: 400 }}>
              {doneCount}/{rounds.length}
            </span>
          )}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={closeDrawer}
          />
        </div>
      </div>

      {/* ===== 执行完成提示 ===== */}
      {allDone && (
        <div
          style={{
            padding: '6px 0',
            textAlign: 'center',
            fontSize: 12,
            color: '#52c41a',
            borderBottom: '1px solid #f0f0f0',
            flexShrink: 0,
          }}
        >
          ✓ 执行完成
        </div>
      )}

      {/* ===== Round 列表 ===== */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {rounds.length === 0 && (
          <div style={{ color: '#8c8c8c', fontSize: 13, textAlign: 'center', padding: 40 }}>
            等待执行…
          </div>
        )}
        {rounds.map((round) => (
          <AgentRoundComponent
            key={round.id}
            round={round}
            isActive={effectiveExpanded === round.id}
            onToggle={() => handleToggle(round.id)}
            onToolClick={handleToolClick}
          />
        ))}
      </div>
    </div>
  );
};

export default ExecutionDrawer;
