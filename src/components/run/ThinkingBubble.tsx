import React from 'react';
import { useExecutionStore } from '../../stores/executionStore';

/**
 * ThinkingBubble — 思考气泡 (单例模式)
 *
 * 行为: thinkingText 非空时渲染一个左对齐灰色气泡,
 *       内容随 executionStore.thinkingText 实时刷新,
 *       thinkingHint 显示为副文案.
 *       ToolItem 点击后通过 data-thinking-bubble 属性 scrollIntoView 定位.
 */
const ThinkingBubble: React.FC = () => {
  const thinkingText = useExecutionStore((s) => s.thinkingText);
  const thinkingHint = useExecutionStore((s) => s.thinkingHint);

  if (!thinkingText) return null;

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }} data-thinking-bubble>
      <div
        style={{
          maxWidth: '85%',
          background: '#f0f2f5',
          border: '1px solid #e8e8e8',
          borderRadius: 12,
          padding: '10px 14px',
          fontSize: 13,
        }}
      >
        <div style={{ color: '#1677ff', marginBottom: thinkingHint ? 4 : 0, fontWeight: 500 }}>
          🧠 {thinkingText}
        </div>
        {thinkingHint && (
          <div style={{ color: '#8c8c8c', fontSize: 12 }}>{thinkingHint}</div>
        )}
      </div>
    </div>
  );
};

export default ThinkingBubble;
