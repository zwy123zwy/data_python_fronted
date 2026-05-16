import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { MessageOutlined, SendOutlined } from '@ant-design/icons';
import { presetQuestionService } from '../../services/presetQuestion';
import type { PresetQuestion } from '../../types';

interface Props {
  agentId: number;
  onQuestionClick: (question: string) => void;
}

const PresetQuestions: React.FC<Props> = ({ agentId, onQuestionClick }) => {
  const [questions, setQuestions] = useState<PresetQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    presetQuestionService
      .list(agentId)
      .then((res) => setQuestions((res.data.data || []).filter((q: PresetQuestion) => q.isActive)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <Spin size="small" />
        <span style={{ marginLeft: 8, color: '#909399', fontSize: 13 }}>加载预设问题...</span>
      </div>
    );
  }

  if (!questions.length) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        fontSize: 14, fontWeight: 500, color: '#606266',
      }}>
        <MessageOutlined style={{ color: '#409eff' }} />
        <span>试试这些问题快速开始</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q) => (
          <div
            key={q.id}
            onClick={() => onQuestionClick(q.question)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 16px',
              background: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              color: '#0050b3',
              lineHeight: 1.6,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#bae7ff';
              e.currentTarget.style.borderColor = '#40a9ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#e6f7ff';
              e.currentTarget.style.borderColor = '#91d5ff';
            }}
          >
            <span style={{ flex: 1 }}>{q.question}</span>
            <SendOutlined style={{ marginLeft: 12, fontSize: 12, color: '#69c0ff', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PresetQuestions;
