import React, { useState } from 'react';
import { Card, Button, Space, Input, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { GraphNodeResponse } from '../../types';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  rejectCount: number;
  nodeBlocks: GraphNodeResponse[][];
  onFeedback: (approved: boolean, feedbackContent: string) => void;
}

const HumanFeedback: React.FC<Props> = ({ rejectCount, nodeBlocks, onFeedback }) => {
  const [feedbackContent, setFeedbackContent] = useState('');

  // Extract plan steps from node blocks
  const planText = nodeBlocks
    .flat()
    .filter((n) => n.nodeName === 'HumanFeedbackNode' || n.nodeName === 'PlannerNode')
    .map((n) => n.text)
    .join('\n');

  let planSteps: string[] = [];
  try {
    const parsed = JSON.parse(planText);
    if (parsed.steps) {
      planSteps = parsed.steps.map((s: { type: string; description: string }, i: number) => `${i + 1}. [${s.type}] ${s.description}`);
    } else if (Array.isArray(parsed)) {
      planSteps = parsed.map((s: { type: string; description: string }, i: number) => `${i + 1}. [${s.type}] ${s.description}`);
    }
  } catch {
    planSteps = planText ? planText.split('\n').filter(Boolean) : [];
  }

  return (
    <Card
      style={{ maxWidth: 600, margin: '0 auto', border: '2px solid #faad14' }}
      title={
        <Space>
          <Tag color="warning">需要人工审核</Tag>
          {rejectCount > 0 && <Tag color="red">拒绝 #{rejectCount}</Tag>}
        </Space>
      }
    >
      {planSteps.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong>执行计划：</Text>
          <ol style={{ marginTop: 8, paddingLeft: 20 }}>
            {planSteps.map((step, i) => (
              <li key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      <TextArea
        placeholder="可选：对执行计划的反馈意见..."
        value={feedbackContent}
        onChange={(e) => setFeedbackContent(e.target.value)}
        rows={3}
        style={{ marginBottom: 16 }}
      />

      <Space>
        <Button type="primary" icon={<CheckOutlined />} onClick={() => onFeedback(true, feedbackContent)}>
          批准
        </Button>
        <Button danger icon={<CloseOutlined />} onClick={() => onFeedback(false, feedbackContent)}>
          拒绝并重新规划
        </Button>
      </Space>
      {rejectCount >= 2 && (
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          最多允许 3 次拒绝。当前为第 {rejectCount + 1} 次拒绝。
        </Text>
      )}
    </Card>
  );
};

export default HumanFeedback;
