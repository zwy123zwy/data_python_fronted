import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, InputNumber, Switch, Tag, message, Popconfirm, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { modelConfigService } from '../services/modelConfig';
import type { ModelConfig, ModelProvider, ModelType } from '../types';

const { Title } = Typography;

const PROVIDER_OPTIONS: { label: string; value: ModelProvider }[] = [
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'Qwen', value: 'qwen' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'SiliconFlow', value: 'siliconflow' },
  { label: '自定义', value: 'custom' },
];

const ModelConfigView: React.FC = () => {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ModelConfig | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchModels = async () => {
    setLoading(true);
    try { const res = await modelConfigService.list(); setModels(res.data.data || []); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchModels(); }, []);

  const openEditor = (record?: ModelConfig) => {
    setEditing(record || null);
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        ...record,
        apiKey: '',
      });
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing?.id) {
        await modelConfigService.update({ id: editing.id, ...values });
        message.success('更新成功');
      } else {
        await modelConfigService.add(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchModels();
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    try { await modelConfigService.delete(id); message.success('删除成功'); fetchModels(); }
    catch { message.error('删除失败'); }
  };

  const handleActivate = async (id: number) => {
    try { await modelConfigService.activate(id); message.success('已激活'); fetchModels(); }
    catch { message.error('激活失败'); }
  };

  const handleTest = async (record: ModelConfig) => {
    try { const res = await modelConfigService.test(record); message.success(res.data.data || '连接成功'); }
    catch { message.error('连接失败'); }
  };

  const columns = [
    { title: '提供商', dataIndex: 'provider', key: 'provider', render: (v: string) => <Tag>{v}</Tag> },
    { title: '模型', dataIndex: 'modelName', key: 'model' },
    { title: '类型', dataIndex: 'modelType', key: 'type', render: (v: ModelType) => <Tag color={v === 'CHAT' ? 'blue' : 'purple'}>{v === 'CHAT' ? '对话' : '嵌入'}</Tag> },
    { title: '接口地址', dataIndex: 'baseUrl', key: 'url', ellipsis: true },
    {
      title: '状态', dataIndex: 'isActive', key: 'active',
      render: (v: boolean) => v ? <Tag color="green">活跃</Tag> : <Tag>未激活</Tag>,
    },
    {
      title: '操作', key: 'actions', render: (_: unknown, r: ModelConfig) => (
        <Space>
          <Button size="small" onClick={() => handleTest(r)}>测试</Button>
          {!r.isActive && <Button size="small" type="primary" onClick={() => handleActivate(r.id)}>激活</Button>}
          <Button size="small" onClick={() => openEditor(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Title level={4}>模型配置</Title>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor()}>添加模型</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={models} loading={loading} pagination={false} />

      <Modal
        title={editing ? '编辑模型' : '添加模型'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="provider" label="提供商" rules={[{ required: true }]}>
            <Select options={PROVIDER_OPTIONS} />
          </Form.Item>
          <Form.Item name="apiKey" label="API Key" rules={[{ required: true }]}>
            <Input.Password placeholder={editing ? '留空则不修改' : undefined} />
          </Form.Item>
          <Form.Item name="baseUrl" label="接口地址" rules={[{ required: true }]}>
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>
          <Form.Item name="modelName" label="模型名称" rules={[{ required: true }]}>
            <Input placeholder="model-name" />
          </Form.Item>
          <Form.Item name="modelType" label="模型类型" rules={[{ required: true }]}>
            <Select options={[{ label: '对话', value: 'CHAT' }, { label: '嵌入', value: 'EMBEDDING' }]} />
          </Form.Item>
          <Form.Item name="temperature" label="温度">
            <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maxTokens" label="最大 Token 数">
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="completionsPath" label="对话接口路径">
            <Input placeholder="/chat/completions" />
          </Form.Item>
          <Form.Item name="embeddingsPath" label="嵌入接口路径">
            <Input placeholder="/embeddings" />
          </Form.Item>
          <Form.Item name="proxyEnabled" label="启用代理" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.proxyEnabled !== cur.proxyEnabled}>
            {({ getFieldValue }) => getFieldValue('proxyEnabled') ? (
              <>
                <Form.Item name="proxyHost" label="代理地址"><Input /></Form.Item>
                <Form.Item name="proxyPort" label="代理端口"><InputNumber style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="proxyUsername" label="代理用户名"><Input /></Form.Item>
                <Form.Item name="proxyPassword" label="代理密码"><Input.Password /></Form.Item>
              </>
            ) : null}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModelConfigView;
