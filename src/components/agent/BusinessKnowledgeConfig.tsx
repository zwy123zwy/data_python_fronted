import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Switch, Tag, message, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { businessKnowledgeService } from '../../services/businessKnowledge';
import type { BusinessKnowledgeVO } from '../../types';

interface Props { agentId: number }

const BusinessKnowledgeConfig: React.FC<Props> = ({ agentId }) => {
  const [list, setList] = useState<BusinessKnowledgeVO[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessKnowledgeVO | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try { const res = await businessKnowledgeService.list(agentId, keyword); setList(res.data.data || []); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, [agentId, keyword]);

  const openEditor = (record?: BusinessKnowledgeVO) => {
    setEditing(record || null);
    form.resetFields();
    if (record) { form.setFieldsValue(record); }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing?.id) {
        await businessKnowledgeService.update(editing.id, { ...values, agentId });
        message.success('已更新');
      } else {
        await businessKnowledgeService.create({ ...values, agentId, isRecall: true });
        message.success('已创建');
      }
      setModalOpen(false);
      fetchList();
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  const columns = [
    { title: '术语', dataIndex: 'businessTerm', key: 'term' },
    { title: '描述', dataIndex: 'description', key: 'desc', ellipsis: true },
    { title: '同义词', dataIndex: 'synonyms', key: 'syn' },
    {
      title: '召回', dataIndex: 'isRecall', key: 'recall',
      render: (v: boolean, r: BusinessKnowledgeVO) => (
        <Switch checked={v} onChange={(c) => businessKnowledgeService.toggleRecall(r.id, c).then(fetchList)} />
      ),
    },
    { title: '嵌入状态', dataIndex: 'embeddingStatus', key: 'es', render: (v: string) => <Tag color={v === 'SUCCESS' ? 'green' : v === 'FAILED' ? 'red' : 'orange'}>{v}</Tag> },
    {
      title: '操作', key: 'actions', render: (_: unknown, r: BusinessKnowledgeVO) => (
        <Space>
          <Button size="small" onClick={() => openEditor(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => businessKnowledgeService.delete(r.id).then(fetchList)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor()}>添加术语</Button>
        <Input.Search placeholder="搜索..." style={{ width: 200 }} onSearch={(v) => setKeyword(v)} allowClear />
        <Button icon={<ReloadOutlined />} onClick={() => businessKnowledgeService.refreshVectorStore(agentId).then(() => message.success('已刷新'))}>刷新向量库</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={{ pageSize: 15 }} />

      <Modal title={editing ? '编辑术语' : '添加术语'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={saving}>
        <Form form={form} layout="vertical">
          <Form.Item name="businessTerm" label="术语" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="synonyms" label="同义词"><Input placeholder="逗号分隔" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BusinessKnowledgeConfig;
