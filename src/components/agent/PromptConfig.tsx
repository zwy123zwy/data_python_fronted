import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, InputNumber, Switch, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import type { PromptConfig } from '../../types';

interface Props { agentId: number; promptType?: string }

const PromptConfig: React.FC<Props> = ({ promptType = 'report-generator' }) => {
  const [list, setList] = useState<PromptConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState(promptType);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PromptConfig | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try { const res = await axios.get(`/api/prompt-config/list-by-type/${type}`); setList(res.data.data || []); }
    catch { message.error('加载提示词失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, [type]);

  const openEditor = (record?: PromptConfig) => {
    setEditing(record || null);
    form.resetFields();
    if (record) { form.setFieldsValue(record); }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await axios.post('/api/prompt-config/save', { ...values, id: editing?.id, promptType: type });
      message.success('已保存');
      setModalOpen(false);
      fetchList();
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  const handleEnable = async (id: number, enabled: boolean) => {
    try {
      await axios.post(`/api/prompt-config/${id}/${enabled ? 'enable' : 'disable'}`);
      message.success(enabled ? '已启用' : '已禁用');
      fetchList();
    } catch { message.error('失败'); }
  };

  const columns = [
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true, render: (v: string) => v?.substring(0, 100) },
    { title: '优先级', dataIndex: 'priority', key: 'priority' },
    { title: '排序', dataIndex: 'sortOrder', key: 'sort' },
    {
      title: '已启用', dataIndex: 'enabled', key: 'enabled',
      render: (v: boolean, r: PromptConfig) => <Switch checked={v} onChange={() => handleEnable(r.id, !v)} />,
    },
    {
      title: '操作', key: 'actions', render: (_: unknown, r: PromptConfig) => (
        <Space>
          <Button size="small" onClick={() => openEditor(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={async () => { await axios.delete(`/api/prompt-config/${r.id}`); fetchList(); }}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select value={type} onChange={setType} style={{ width: 200 }}>
          <Select.Option value="report-generator">报告生成器</Select.Option>
          <Select.Option value="sql-generate">SQL 生成</Select.Option>
          <Select.Option value="python-generate">Python 生成</Select.Option>
          <Select.Option value="planner">计划器</Select.Option>
        </Select>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor()}>添加提示词</Button>
        <Button onClick={async () => { await axios.post('/api/prompt-config/batch-enable'); fetchList(); }}>全部启用</Button>
        <Button onClick={async () => { await axios.post('/api/prompt-config/batch-disable'); fetchList(); }}>全部禁用</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={list} loading={loading} pagination={false} />

      <Modal title={editing ? '编辑提示词' : '添加提示词'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={saving} width={700}>
        <Form form={form} layout="vertical">
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={10} /></Form.Item>
          <Form.Item name="priority" label="优先级"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="sortOrder" label="排序"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PromptConfig;
