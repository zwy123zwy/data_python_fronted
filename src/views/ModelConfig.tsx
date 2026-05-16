import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, InputNumber, Switch, Tag, Popconfirm, Typography, Empty, App } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
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

const PROVIDER_BASE_URL_MAP: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
  openai: 'https://api.openai.com',
  siliconflow: 'https://api.siliconflow.cn',
  custom: '',
};

const getProviderTagColor = (provider: string) => {
  const colorMap: Record<string, string> = {
    deepseek: 'green',
    qwen: 'orange',
    openai: 'blue',
    siliconflow: 'red',
    custom: 'default',
  };
  return colorMap[provider] || 'default';
};

const ModelConfigView: React.FC = () => {
  const { message, modal } = App.useApp();
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ModelConfig | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<ModelType | ''>('');

  const fetchModels = async () => {
    setLoading(true);
    try { const res = await modelConfigService.list(); setModels(res.data.data || []); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchModels(); }, []);

  const filteredModels = useMemo(() => {
    if (!activeFilter) return models;
    return models.filter(m => m.modelType === activeFilter);
  }, [models, activeFilter]);

  const updateBaseUrlByProvider = (provider: string) => {
    if (provider && provider !== 'custom') {
      form.setFieldValue('baseUrl', PROVIDER_BASE_URL_MAP[provider] || '');
    }
  };

  const openEditor = (record?: ModelConfig) => {
    setEditing(record || null);
    form.resetFields();
    if (record) {
      form.setFieldsValue({
        ...record,
        apiKey: '',
      });
    } else {
      form.setFieldsValue({
        provider: undefined,
        apiKey: '',
        baseUrl: '',
        modelName: '',
        modelType: 'CHAT',
        temperature: 0.0,
        maxTokens: 2000,
        completionsPath: '',
        embeddingsPath: '',
        isActive: false,
        proxyEnabled: false,
        proxyHost: '',
        proxyPort: 7890,
        proxyUsername: '',
        proxyPassword: '',
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

  const handleDelete = async (record: ModelConfig) => {
    if (!record.id) return;
    try { await modelConfigService.delete(record.id); message.success('配置删除成功'); fetchModels(); }
    catch { message.error('配置删除失败'); }
  };

  const handleActivate = async (record: ModelConfig) => {
    if (!record.id) return;

    if (record.modelType === 'EMBEDDING') {
      modal.confirm({
        title: '切换嵌入模型确认',
        content: '您正在更换嵌入模型，此操作风险较高！由于不同模型的向量空间不一致，切换后可能导致所有历史向量数据（含数据源、智能体知识、业务知识）将全部失效且无法检索。确定要执行吗？',
        okText: '确定继续',
        cancelText: '取消',
        okType: 'danger',
        onOk: async () => {
          setActivatingId(record.id!);
          try {
            await modelConfigService.activate(record.id!);
            message.success('已激活');
            fetchModels();
          } catch { message.error('激活失败'); }
          finally { setActivatingId(null); }
        },
      });
      return;
    }

    setActivatingId(record.id);
    try { await modelConfigService.activate(record.id); message.success('已激活'); fetchModels(); }
    catch { message.error('激活失败'); }
    finally { setActivatingId(null); }
  };

  const handleTest = async (record: ModelConfig) => {
    if (!record.id) return;
    setTestingId(record.id);
    try { const res = await modelConfigService.test(record); message.success(res.data.message || res.data.data || '连接测试成功！'); }
    catch { message.error('连接失败'); }
    finally { setTestingId(null); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '提供商', dataIndex: 'provider', key: 'provider', width: 120,
      render: (v: string) => <Tag color={getProviderTagColor(v)}>{v}</Tag>,
    },
    { title: '模型名称', dataIndex: 'modelName', key: 'model', width: 180 },
    {
      title: '模型类型', dataIndex: 'modelType', key: 'type', width: 120,
      render: (v: ModelType) => <Tag color={v === 'CHAT' ? 'blue' : 'purple'}>{v === 'CHAT' ? '对话模型' : '嵌入模型'}</Tag>,
    },
    { title: 'API地址', dataIndex: 'baseUrl', key: 'url', width: 220, ellipsis: true },
    {
      title: '路径配置', key: 'pathConfig', width: 200, ellipsis: true,
      render: (_: unknown, r: ModelConfig) => {
        if (r.modelType === 'CHAT' && r.completionsPath) {
          return <Tag color="blue">对话: {r.completionsPath}</Tag>;
        }
        if (r.modelType === 'EMBEDDING' && r.embeddingsPath) {
          return <Tag color="purple">嵌入: {r.embeddingsPath}</Tag>;
        }
        return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>使用默认路径</span>;
      },
    },
    {
      title: '温度', dataIndex: 'temperature', key: 'temp', width: 100,
      render: (v: number) => v ?? 0.0,
    },
    {
      title: '最大Token', dataIndex: 'maxTokens', key: 'tokens', width: 120,
      render: (v: number) => v ?? 2000,
    },
    {
      title: '状态', dataIndex: 'isActive', key: 'active', width: 100,
      render: (v: boolean) => v ? <Tag color="green">已启用</Tag> : <Tag>未启用</Tag>,
    },
    {
      title: '操作', key: 'actions', width: 320, fixed: 'right',
      render: (_: unknown, r: ModelConfig) => (
        <Space>
          <Button size="small" onClick={() => handleTest(r)} loading={testingId === r.id}>连接测试</Button>
          {!r.isActive && (
            <Button size="small" type="primary" onClick={() => handleActivate(r)} loading={activatingId === r.id}>启用</Button>
          )}
          <Button size="small" onClick={() => openEditor(r)}>编辑</Button>
          <Popconfirm title={`确定要删除配置 "${r.provider} - ${r.modelName}" 吗？此操作不可恢复。`} onConfirm={() => handleDelete(r)}>
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
        <Button icon={<ReloadOutlined />} onClick={fetchModels}>刷新</Button>
        <Select
          value={activeFilter}
          onChange={setActiveFilter}
          placeholder="筛选模型类型"
          allowClear
          style={{ width: 240 }}
          options={[
            { label: '全部', value: '' },
            { label: '对话模型 (CHAT)', value: 'CHAT' },
            { label: '嵌入模型 (EMBEDDING)', value: 'EMBEDDING' },
          ]}
        />
      </Space>
      <div className="model-config-table">
        {!loading && filteredModels.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Empty description="暂无模型配置">
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>新增配置</Button>
            </Empty>
          </div>
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filteredModels}
            loading={loading}
            pagination={false}
            scroll={{ x: 1500 }}
          />
        )}
      </div>

      <Modal
        title={editing ? '编辑模型' : '添加模型'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical" labelCol={{ style: { width: 120 } }}>
          <Form.Item name="provider" label="提供商" rules={[{ required: true, message: '请选择提供商' }]}>
            <Select
              options={PROVIDER_OPTIONS}
              onChange={updateBaseUrlByProvider}
              placeholder="请选择提供商"
            />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const provider = getFieldValue('provider');
                  if (provider === 'custom' || (value && value.trim())) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('请输入API密钥'));
                },
              }),
            ]}
          >
            <Input.Password placeholder={editing ? '留空则不修改' : undefined} />
          </Form.Item>
          <Form.Item name="baseUrl" label="Base URL" rules={[{ required: true, message: '请输入API地址' }]}>
            <Input placeholder="请填写兼容 OpenAI 协议的 Base URL，通常不包含 /v1 后缀" />
          </Form.Item>
          <Form.Item name="modelName" label="模型名称" rules={[{ required: true, message: '请输入模型名称' }]}>
            <Input placeholder="例如: gpt-4, deepseek-chat, qwen-plus, text-embedding-v4" />
          </Form.Item>
          <Form.Item name="modelType" label="模型类型" rules={[{ required: true, message: '请选择模型类型' }]}>
            <Select options={[{ label: '对话模型', value: 'CHAT' }, { label: '嵌入模型', value: 'EMBEDDING' }]} />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.modelType !== cur.modelType}>
            {({ getFieldValue }) => {
              const modelType = getFieldValue('modelType');
              if (modelType === 'CHAT') {
                return (
                  <Form.Item name="completionsPath" label="Completions路径">
                    <Input placeholder="附加到base-url的路径。留空则使用默认值/v1/chat/completions" />
                  </Form.Item>
                );
              }
              if (modelType === 'EMBEDDING') {
                return (
                  <Form.Item name="embeddingsPath" label="Embeddings路径">
                    <Input placeholder="附加到base-url的路径。留空则使用默认值/v1/embeddings" />
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item
            name="temperature"
            label="温度"
            rules={[{ type: 'number', min: 0, max: 2, message: '温度值必须在0-2之间' }]}
          >
            <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: -18, marginBottom: 24 }}>
            建议默认0。控制生成文本的随机性，值越高越随机
          </div>

          <Form.Item
            name="maxTokens"
            label="最大Token"
            rules={[{ type: 'number', min: 100, max: 10000, message: '最大Token必须在100-10000之间' }]}
          >
            <InputNumber min={100} max={10000} step={100} style={{ width: '100%' }} />
          </Form.Item>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: -18, marginBottom: 24 }}>
            控制生成文本的最大长度
          </div>

          <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginBottom: 16, fontWeight: 500 }}>
            网络代理配置
          </div>

          <Form.Item name="proxyEnabled" label="启用代理" valuePropName="checked">
            <Switch />
          </Form.Item>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: -6, marginBottom: 16 }}>
            如果您的服务器处于受限内网，请开启代理以连接 AI 服务
          </div>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.proxyEnabled !== cur.proxyEnabled}>
            {({ getFieldValue }) => getFieldValue('proxyEnabled') ? (
              <>
                <Form.Item
                  name="proxyHost"
                  label="代理主机"
                  rules={[
                    ({ getFieldValue: gf }) => ({
                      validator(_, value) {
                        if (gf('proxyEnabled') && (!value || !value.trim())) {
                          return Promise.reject(new Error('启用代理时，必须填写代理主机地址'));
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <Input placeholder="例如: 127.0.0.1 或 proxy.example.com" />
                </Form.Item>
                <Form.Item
                  name="proxyPort"
                  label="代理端口"
                  rules={[
                    ({ getFieldValue: gf }) => ({
                      validator(_, value) {
                        if (gf('proxyEnabled') && !value) {
                          return Promise.reject(new Error('启用代理时，必须填写代理端口'));
                        }
                        return Promise.resolve();
                      },
                    }),
                  ]}
                >
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="proxyUsername" label="代理用户名">
                  <Input placeholder="可选，代理服务器需要认证时填写" />
                </Form.Item>
                <Form.Item name="proxyPassword" label="代理密码">
                  <Input.Password placeholder="可选" />
                </Form.Item>
              </>
            ) : null}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ModelConfigView;
