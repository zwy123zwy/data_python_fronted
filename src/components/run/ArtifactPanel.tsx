/**
 * [??2] ArtifactPanel - SQL / table artifacts
 */

import React from 'react';
import { useRunStore } from '../../stores/runStore';
import styles from './ArtifactPanel.module.css';

const ArtifactPanel: React.FC = () => {
  const artifacts = useRunStore((s) => s.artifacts);
  const items = Array.from(artifacts.values());

  if (items.length === 0) {
    return <div className={styles.empty}>{'\u6682\u65e0\u4ea7\u7269'}</div>;
  }

  return (
    <div className={styles.panel}>
      {items.map((a) => (
        <div key={a.id} className={styles.card}>
          <div className={styles.title}>{a.type.toUpperCase()}</div>
          {a.type === 'sql' && <pre className={styles.pre}>{a.payload}</pre>}
          {a.type === 'table' && (
            <pre className={styles.pre}>{a.payload?.slice(0, 2000)}</pre>
          )}
        </div>
      ))}
    </div>
  );
};

export default ArtifactPanel;
