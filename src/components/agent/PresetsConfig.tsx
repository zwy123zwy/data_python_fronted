import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Input, InputNumber, Switch, Popconfirm, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { presetQuestionService } from '../../services/presetQuestion';
import type { PresetQuestion, PresetQuestionDTO } from '../../types';

interface Props { agentId: number }

const PresetsConfig: React.FC<Props> = ({ agentId }) => {
  const { message } = App.useApp();
  const [questions, setQuestions] = useState<PresetQuestionDTO[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    try {
      const res = await presetQuestionService.list(agentId);
      const data = res.data.data || [];
      setQuestions(data.map((q: PresetQuestion) => ({ question: q.question, sortOrder: q.sortOrder, isActive: q.isActive })));
    } catch { message.error('加载失败'); }
  };

  useEffect(() => { fetchList(); }, [agentId]);

  const handleAdd = () => {
    setQuestions([...questions, { question: '', sortOrder: questions.length, isActive: true }]);
  };

  const handleChange = (index: number, field: string, value: unknown) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const handleDelete = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

  const handleBatchSave = async () => {
    setSaving(true);
    try {
      await presetQuestionService.batchSave(agentId, questions);
      message.success('已保存');
      fetchList();
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>添加问题</Button>
        <Button onClick={handleBatchSave} loading={saving}>全部保存</Button>
      </Space>
      <Table
        rowKey={(_, i) => String(i)}
        columns={[
          {
            title: '问题', render: (_: unknown, r: PresetQuestionDTO, i: number) => (
              <Input value={r.question} onChange={(e) => handleChange(i, 'question', e.target.value)} placeholder="输入问题" />
            ),
          },
          {
            title: '排序', width: 80, render: (_: unknown, r: PresetQuestionDTO, i: number) => (
              <InputNumber value={r.sortOrder} onChange={(v) => handleChange(i, 'sortOrder', v)} size="small" min={0} />
            ),
          },
          {
            title: '启用', width: 70, render: (_: unknown, r: PresetQuestionDTO, i: number) => (
              <Switch checked={r.isActive} onChange={(v) => handleChange(i, 'isActive', v)} size="small" />
            ),
          },
          {
            title: '', width: 50, render: (_: unknown, __: unknown, i: number) => (
              <Popconfirm title="确定移除？" onConfirm={() => handleDelete(i)}>
                <Button size="small" danger>×</Button>
              </Popconfirm>
            ),
          },
        ]}
        dataSource={questions}
        pagination={false}
      />
    </div>
  );
};

export default PresetsConfig;
