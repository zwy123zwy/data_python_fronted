import React, { useEffect, useState, useMemo } from 'react';
import { Card, Button, Space, Typography, Switch, Input, Alert, Tabs, Popconfirm, App } from 'antd';
import { CopyOutlined, EyeOutlined, EyeInvisibleOutlined, KeyOutlined } from '@ant-design/icons';
import { agentService } from '../../services/agent';

const { Text } = Typography;

interface AccessApiProps {
  agentId: number;
}

const maskKey = (key: string): string => {
  if (!key) return '';
  if (key.startsWith('****')) return key;
  if (key.length <= 8) return '****';
  return '****' + key.slice(-4);
};

const AccessApi: React.FC<AccessApiProps> = ({ agentId }) => {
  const { message } = App.useApp();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyEnabled, setApiKeyEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masked, setMasked] = useState(true);
  const [canCopy, setCanCopy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchApiKey = async () => {
    setLoading(true);
    try {
      const res = await agentService.getApiKey(agentId);
      const data = res.data.data || {};
      setApiKey(data.apiKey || null);
      setApiKeyEnabled(data.apiKeyEnabled || false);
      setMasked(true);
      setCanCopy(false);
    } catch {
      // No key yet, that's OK
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApiKey(); }, [agentId]);

  const displayKey = useMemo(() => {
    if (!apiKey) return '';
    return masked ? maskKey(apiKey) : apiKey;
  }, [apiKey, masked]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await agentService.generateApiKey(agentId);
      const data = res.data.data || {};
      setApiKey(data.apiKey || null);
      setApiKeyEnabled(data.apiKeyEnabled ?? true);
      setMasked(false);
      setCanCopy(true);
      message.success('API Key 已生成');
    } catch {
      message.error('生成 API Key 失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = async () => {
    if (!apiKey) {
      await handleGenerate();
      return;
    }
    setResetting(true);
    try {
      const res = await agentService.resetApiKey(agentId);
      const data = res.data.data || {};
      setApiKey(data.apiKey || null);
      setApiKeyEnabled(data.apiKeyEnabled ?? true);
      setMasked(false);
      setCanCopy(true);
      message.success('API Key 已重置');
    } catch {
      message.error('重置 API Key 失败');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await agentService.deleteApiKey(agentId);
      const data = res.data.data || {};
      setApiKey(data.apiKey || null);
      setApiKeyEnabled(data.apiKeyEnabled || false);
      setMasked(true);
      setCanCopy(false);
      message.success('API Key 已删除');
    } catch {
      message.error('删除 API Key 失败');
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    setToggling(true);
    try {
      const res = await agentService.enableApiKey(agentId, enabled);
      const data = res.data.data || {};
      setApiKeyEnabled(data.apiKeyEnabled ?? enabled);
      setApiKey(data.apiKey);
      setMasked(true);
      setCanCopy(false);
      message.success(enabled ? 'API Key 已启用' : 'API Key 已禁用');
    } catch {
      setApiKeyEnabled(!enabled);
      message.error('切换失败');
    } finally {
      setToggling(false);
    }
  };

  const handleCopy = () => {
    if (!canCopy || !apiKey) {
      message.info('请重新生成或重置后复制完整 Key');
      return;
    }
    navigator.clipboard.writeText(apiKey);
    message.success('已复制到剪贴板');
  };

  const toggleMask = () => {
    if (!apiKey) return;
    setMasked(!masked);
  };

  // 调用示例代码
  const baseUrl = window.location.origin;
  const curlExample = `# 创建会话
curl -X POST "${baseUrl}/api/agent/${agentId}/sessions" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <your_api_key>" \\
  -d '{"title":"demo"}'

# 发送消息
curl -X POST "${baseUrl}/api/sessions/<sessionId>/messages" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: <your_api_key>" \\
  -d '{"role":"user","content":"给我一个示例","messageType":"text"}'`;

  const jsExample = `const apiKey = '<your_api_key>';
const baseUrl = '${baseUrl}/api';
const agentId = ${agentId};

(async () => {
  // 创建会话
  const sessionRes = await fetch(\`\${baseUrl}/agent/\${agentId}/sessions\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ title: 'demo' }),
  });
  const session = await sessionRes.json();

  // 发送消息
  await fetch(\`\${baseUrl}/sessions/\${session.id}/messages\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({ role: 'user', content: '你好', messageType: 'text' }),
  });
})();`;

  const pyExample = `import requests

api_key = '<your_api_key>'
base_url = '${baseUrl}/api'

headers = {
    'Content-Type': 'application/json',
    'X-API-Key': api_key,
}

# 创建会话
session_resp = requests.post(
    f"{base_url}/agent/${agentId}/sessions",
    headers=headers,
    json={"title": "demo"},
)
session_id = session_resp.json().get("id")

# 发送消息
requests.post(
    f"{base_url}/sessions/{session_id}/messages",
    headers=headers,
    json={"role": "user", "content": "你好", "messageType": "text"},
)`;

  if (loading) return <div>加载中...</div>;

  return (
    <div style={{ maxWidth: 720 }}>
      {/* API Key 管理 */}
      <Card title="访问 API Key" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Text strong>API Key 状态：</Text>
          <Switch
            checked={apiKeyEnabled}
            disabled={!apiKey}
            onChange={handleToggleEnabled}
            loading={toggling}
          />
          <Text type="secondary">{apiKeyEnabled ? '已启用' : '已禁用'}</Text>
          {!apiKey && <Text type="secondary">（未生成）</Text>}
        </div>

        <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Text strong>当前 Key：</Text>
          <Input
            style={{ flex: 1, minWidth: 200 }}
            value={displayKey}
            readOnly
            placeholder="尚未生成 API Key"
          />
          <Button icon={apiKey ? <KeyOutlined /> : undefined} type="primary" onClick={handleGenerate} loading={generating}>
            {apiKey ? '重新生成' : '生成 Key'}
          </Button>
          <Button onClick={handleReset} disabled={!apiKey} loading={resetting}>重置</Button>
          <Popconfirm title="确认删除当前 API Key？删除后需重新生成。" onConfirm={handleDelete} okText="删除" cancelText="取消">
            <Button danger disabled={!apiKey}>删除</Button>
          </Popconfirm>
          <Button icon={<CopyOutlined />} onClick={handleCopy} disabled={!apiKey || !canCopy}>复制</Button>
          <Button icon={masked ? <EyeOutlined /> : <EyeInvisibleOutlined />} onClick={toggleMask} disabled={!apiKey}>
            {masked ? '显示' : '隐藏'}
          </Button>
        </div>

        {!canCopy && apiKey && (
          <Alert
            type="info"
            showIcon
            message="为安全起见，已生成/重置时才显示完整 Key，之后仅显示掩码。如需复制请重新生成/重置。"
            style={{ marginBottom: 8 }}
          />
        )}

        {!apiKey && (
          <Alert
            type="info"
            showIcon
            message="生成 API Key 以允许外部系统通过 API 访问该智能体。"
            style={{ marginTop: 8 }}
          />
        )}
      </Card>

      {/* 调用示例 */}
      <Card title="调用示例">
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          使用 <Text code>X-API-Key</Text> 请求头调用会话接口。
        </Text>
        <Tabs
          items={[
            {
              key: 'curl',
              label: 'curl',
              children: <pre style={{ background: '#0b1021', color: '#e0e6f6', padding: 14, borderRadius: 8, overflow: 'auto', fontSize: 12 }}><code>{curlExample}</code></pre>,
            },
            {
              key: 'js',
              label: 'JavaScript',
              children: <pre style={{ background: '#0b1021', color: '#e0e6f6', padding: 14, borderRadius: 8, overflow: 'auto', fontSize: 12 }}><code>{jsExample}</code></pre>,
            },
            {
              key: 'py',
              label: 'Python',
              children: <pre style={{ background: '#0b1021', color: '#e0e6f6', padding: 14, borderRadius: 8, overflow: 'auto', fontSize: 12 }}><code>{pyExample}</code></pre>,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default AccessApi;
