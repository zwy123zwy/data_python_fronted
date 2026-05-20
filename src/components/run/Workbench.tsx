/**
 * [??3] Workbench - three-tab sidebar (thinking / execution / deliverables)
 */

import React from 'react';
import { Tabs } from 'antd';
import { useRunStore } from '../../stores/runStore';
import ArtifactPanel from './ArtifactPanel';
import ExecutionDrawer from './ExecutionDrawer';
import styles from './Workbench.module.css';

const Workbench: React.FC<{ useV2Workbench?: boolean }> = ({ useV2Workbench }) => {
  const phase = useRunStore((s) => s.phase);
  const steps = useRunStore((s) => s.steps);

  if (!useV2Workbench) {
    return <ExecutionDrawer />;
  }

  const items = [
    {
      key: 'thinking',
      label: '\u601d\u8003',
      children: (
        <div className={styles.section}>
          <p className={styles.muted}>
            {'Gateway \u4e0e\u8def\u7531\u601d\u8003\u5df2\u5728\u5de6\u4fa7\u5bf9\u8bdd\u533a\u5c55\u793a\u3002\u6b64\u5904\u4ec5\u5c55\u793a\u5de5\u5177\u6267\u884c\u8fc7\u7a0b\u3002'}
          </p>
          {steps.length > 0 && (
            <ul className={styles.stepList}>
              {steps.filter((s) => s.status === 'running').map((s) => (
                <li key={s.id} className={styles.stepItem}>
                  <span>{s.toolName}</span>
                  <span className={styles.status}>{s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    },
    {
      key: 'execution',
      label: `\u6267\u884c (${steps.length})`,
      children: (
        <ul className={styles.stepList}>
          {steps.map((s) => (
            <li key={s.id} className={styles.stepItem}>
              <span>{s.toolName}</span>
              <span className={styles.status}>{s.status}</span>
              <span className={styles.summary}>{s.summary}</span>
            </li>
          ))}
          {steps.length === 0 && <li className={styles.muted}>{'\u6682\u65e0\u6267\u884c\u6b65\u9aa4'}</li>}
        </ul>
      ),
    },
    {
      key: 'deliverables',
      label: '\u4ea7\u51fa',
      children: <ArtifactPanel />,
    },
  ];

  return (
    <div className={styles.workbench}>
      <div className={styles.header}>
        <span>Workbench</span>
        <span className={styles.phase}>phase: {phase}</span>
      </div>
      <Tabs size="small" items={items} />
    </div>
  );
};

export default Workbench;
