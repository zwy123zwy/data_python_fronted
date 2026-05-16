import React, { useState } from 'react';
import { Form, Input, Select, Button, Space, Popconfirm, App } from 'antd';
import { agentService } from '../../services/agent';
import type { Agent } from '../../types';

const { TextArea } = Input;

interface BaseSettingProps {
  agent: Agent;
  onUpdate: () => void;
}

const BaseSetting: React.FC<BaseSettingProps> = ({ agent, onUpdate }) => {
  const { message } = App.useApp();
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    form.setFieldsValue({
      name: agent.name,
      category: agent.category,
      description: agent.description,
      prompt: agent.prompt,
      tags: agent.tags,
      status: agent.status,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await agentService.update(agent.id, values);
      message.success('智能体已更新');
      setEditing(false);
      onUpdate();
    } catch {
      message.error('更新智能体失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await agentService.delete(agent.id);
      message.success('智能体已删除');
      window.location.href = '/agents';
    } catch {
      message.error('删除智能体失败');
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      {editing ? (
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类"><Input /></Form.Item>
          <Form.Item name="description" label="描述"><TextArea rows={3} /></Form.Item>
          <Form.Item name="prompt" label="系统提示词"><TextArea rows={4} /></Form.Item>
          <Form.Item name="tags" label="标签"><Input placeholder="逗号分隔" /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="published">已发布</Select.Option>
              <Select.Option value="offline">已下线</Select.Option>
            </Select>
          </Form.Item>
          <Space>
            <Button type="primary" onClick={handleSave} loading={saving}>保存</Button>
            <Button onClick={() => setEditing(false)}>取消</Button>
          </Space>
        </Form>
      ) : (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button onClick={handleEdit}>编辑</Button>
            <Popconfirm title="确定删除该智能体？" onConfirm={handleDelete} okText="确定" cancelText="取消">
              <Button danger>删除</Button>
            </Popconfirm>
          </Space>
          <table className="table">
            <tbody>
              <tr><td style={{ fontWeight: 600, width: 120 }}>名称</td><td>{agent.name}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>分类</td><td>{agent.category || '-'}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>描述</td><td>{agent.description || '-'}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>提示词</td><td><pre style={{ whiteSpace: 'pre-wrap' }}>{agent.prompt || '-'}</pre></td></tr>
              <tr><td style={{ fontWeight: 600 }}>标签</td><td>{agent.tags || '-'}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>状态</td><td>{agent.status}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>创建时间</td><td>{new Date(agent.createTime).toLocaleString()}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>更新时间</td><td>{new Date(agent.updateTime).toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BaseSetting;
