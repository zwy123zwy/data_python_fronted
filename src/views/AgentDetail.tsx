import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tabs, Button, Spin, Space, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { agentService } from '../services/agent';
import type { Agent } from '../types';
import BaseSetting from '../components/agent/BaseSetting';
import DataSourceConfig from '../components/agent/DataSourceConfig';
import PromptConfig from '../components/agent/PromptConfig';
import AgentKnowledgeConfig from '../components/agent/AgentKnowledgeConfig';
import BusinessKnowledgeConfig from '../components/agent/BusinessKnowledgeConfig';
import SemanticsConfig from '../components/agent/SemanticsConfig';
import PresetsConfig from '../components/agent/PresetsConfig';
import AccessApi from '../components/agent/AccessApi';

const { Title } = Typography;

const STATUS_COLOR: Record<string, string> = { published: 'green', draft: 'orange', offline: 'default' };
const STATUS_LABEL: Record<string, string> = { published: '已发布', draft: '草稿', offline: '已下线' };

const AgentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('base');

  const agentId = Number(id);

  const fetchAgent = async () => {
    setLoading(true);
    try {
      const res = await agentService.get(agentId);
      setAgent(res.data.data || null);
    } catch {
      message.error('加载智能体失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!agent) return <div style={{ textAlign: 'center', padding: 60 }}>智能体未找到</div>;

  const tabItems = [
    { key: 'base', label: '基本设置', children: <BaseSetting agent={agent} onUpdate={fetchAgent} /> },
    { key: 'datasource', label: '数据源', children: <DataSourceConfig agentId={agentId} /> },
    { key: 'prompt', label: '提示词', children: <PromptConfig agentId={agentId} /> },
    { key: 'knowledge', label: '知识库', children: <AgentKnowledgeConfig agentId={agentId} /> },
    { key: 'business', label: '业务知识', children: <BusinessKnowledgeConfig agentId={agentId} /> },
    { key: 'semantics', label: '语义模型', children: <SemanticsConfig agentId={agentId} /> },
    { key: 'presets', label: '预设问题', children: <PresetsConfig agentId={agentId} /> },
    { key: 'access', label: 'API 访问', children: <AccessApi agentId={agentId} /> },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/agents')}>返回</Button>
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(`/agent/${agentId}/run`)}>
          运行
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {agent.name}
              <Tag color={STATUS_COLOR[agent.status]} style={{ marginLeft: 8 }}>{STATUS_LABEL[agent.status] || agent.status}</Tag>
              {agent.category && <Tag color="blue" style={{ marginLeft: 4 }}>{agent.category}</Tag>}
            </Title>
            {agent.description && (
              <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                {agent.description}
              </Typography.Paragraph>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      </Card>
    </div>
  );
};

export default AgentDetail;
