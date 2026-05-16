import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Tag, Switch, Popconfirm, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { agentKnowledgeService } from '../../services/agentKnowledge';
import type { AgentKnowledge, KnowledgeType, EmbeddingStatus } from '../../types';

interface Props { agentId: number }

const TYPE_OPTIONS: { label: string; value: KnowledgeType }[] = [
  { label: '文档', value: 'DOCUMENT' },
  { label: '问答', value: 'QA' },
  { label: '常见问题', value: 'FAQ' },
];

const STATUS_COLOR: Record<string, string> = { SUCCESS: 'green', PENDING: 'orange', FAILED: 'red' };

const AgentKnowledgeConfig: React.FC<Props> = ({ agentId }) => {
  const { message } = App.useApp();
  const [list, setList] = useState<AgentKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ pageNum: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState({ type: '', embeddingStatus: '', keyword: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgentKnowledge | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await agentKnowledgeService.queryPage({ agentId, ...filters, ...pagination });
      const data = res.data;
      setList(data.data || []);
      setPagination((p) => ({ ...p, total: data.total || 0 }));
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, [agentId, filters, pagination.pageNum]);

  const openEditor = (record?: AgentKnowledge) => {
    setEditing(record || null);
    form.resetFields();
    if (record) {
      form.setFieldsValue({ title: record.title, content: record.content, type: record.type, question: record.question });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing?.id) {
        await agentKnowledgeService.update(editing.id, { ...values, agentId });
        message.success('已更新');
      } else {
        const fd = new FormData();
        Object.entries({ ...values, agentId }).forEach(([k, v]) => fd.append(k, String(v ?? '')));
        await agentKnowledgeService.create(fd);
        message.success('已创建');
      }
      setModalOpen(false);
      fetchList();
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '类型', dataIndex: 'type', key: 'type', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '嵌入状态', dataIndex: 'embeddingStatus', key: 'eStatus',
      render: (v: EmbeddingStatus) => <Tag color={STATUS_COLOR[v]}>{v}</Tag>,
    },
    {
      title: '召回', dataIndex: 'isRecall', key: 'recall',
      render: (v: boolean, r: AgentKnowledge) => (
        <Switch checked={v} onChange={(c) => agentKnowledgeService.updateRecall(r.id, c).then(fetchList)} />
      ),
    },
    {
      title: '创建时间', dataIndex: 'createdTime', key: 'ct',
      render: (v: string) => v ? new Date(v).toLocaleDateString() : '-',
    },
    {
      title: '操作', key: 'actions', render: (_: unknown, r: AgentKnowledge) => (
        <Space>
          <Button size="small" onClick={() => openEditor(r)}>编辑</Button>
          {r.embeddingStatus === 'FAILED' && (
            <Button size="small" onClick={() => agentKnowledgeService.retryEmbedding(r.id).then(fetchList)}>重试</Button>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => agentKnowledgeService.delete(r.id).then(fetchList)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor()}>添加知识</Button>
        <Select placeholder="类型" allowClear style={{ width: 120 }} onChange={(v) => setFilters({ ...filters, type: v || '' })} options={TYPE_OPTIONS} />
        <Select placeholder="嵌入状态" allowClear style={{ width: 140 }} onChange={(v) => setFilters({ ...filters, embeddingStatus: v || '' })} options={[
          { label: '待处理', value: 'PENDING' }, { label: '成功', value: 'SUCCESS' }, { label: '失败', value: 'FAILED' },
        ]} />
        <Input.Search placeholder="搜索..." style={{ width: 200 }} onSearch={(v) => setFilters({ ...filters, keyword: v })} allowClear />
      </Space>
      <Table
        rowKey="id" columns={columns} dataSource={list} loading={loading}
        pagination={{ ...pagination, onChange: (p) => setPagination((prev) => ({ ...prev, pageNum: p })) }}
      />

      <Modal title={editing ? '编辑知识' : '添加知识'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={saving}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="content" label="内容"><Input.TextArea rows={5} /></Form.Item>
          <Form.Item name="question" label="问题（用于问答）"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AgentKnowledgeConfig;
