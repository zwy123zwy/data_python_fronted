import React, { useState, useEffect } from 'react';
import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useExecutionStore } from '../../stores/executionStore';
import AgentRoundComponent from './AgentRound';
import styles from './ExecutionDrawer.module.css';

/**
 * [阶段0] 执行抽屉：右侧展示 Agent Round / Tool 时序，样式见 ExecutionDrawer.module.css
 *
 * M3 将由 Workbench 常驻侧栏替代布局，本组件逻辑可迁入 ExecutionPanel。
 */
const ExecutionDrawer: React.FC = () => {
  const drawerVisible = useExecutionStore((s) => s.drawerVisible);
  const rounds = useExecutionStore((s) => s.rounds);
  const closeDrawer = useExecutionStore((s) => s.closeDrawer);

  const [expandedRoundId, setExpandedRoundId] = useState<string | null | undefined>(undefined);

  const allDone = rounds.length > 0 && rounds.every((r) => r.status === 'done');
  const doneCount = rounds.filter((r) => r.status === 'done').length;

  const runningRoundId = rounds.find((r) => r.status === 'running')?.id;
  const effectiveExpanded = expandedRoundId !== undefined ? expandedRoundId : runningRoundId;

  useEffect(() => {
    if (rounds.length === 0) {
      setExpandedRoundId(undefined);
    }
  }, [rounds.length]);

  const handleToggle = (roundId: string) => {
    setExpandedRoundId((prev) => (prev === roundId ? null : roundId));
  };

  const handleToolClick = (_toolId: string) => {
    const el = document.querySelector('[data-thinking-bubble]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const drawerClassName = [
    styles.drawer,
    drawerVisible ? styles.drawerOpen : styles.drawerClosed,
  ].join(' ');

  return (
    <div className={drawerClassName}>
      <div className={styles.header}>
        <span>⚙️ 执行过程</span>
        <div className={styles.headerActions}>
          {rounds.length > 0 && (
            <span className={styles.progress}>
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

      {allDone && <div className={styles.doneBanner}>✓ 执行完成</div>}

      <div className={styles.body}>
        {rounds.length === 0 && <div className={styles.empty}>等待执行…</div>}
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
