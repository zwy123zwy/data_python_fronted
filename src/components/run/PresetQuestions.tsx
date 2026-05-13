import React, { useEffect, useState } from 'react';
import { Tag, Spin } from 'antd';
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

  if (loading) return <Spin size="small" />;
  if (!questions.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      {questions.map((q) => (
        <Tag
          key={q.id}
          color="blue"
          style={{ cursor: 'pointer', padding: '4px 10px', borderRadius: 16, fontSize: 12 }}
          onClick={() => onQuestionClick(q.question)}
        >
          {q.question}
        </Tag>
      ))}
    </div>
  );
};

export default PresetQuestions;
