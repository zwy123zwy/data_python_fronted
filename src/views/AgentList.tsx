import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Input,
  Tag,
  Button,
  Spin,
  Space,
  Typography,
  Empty,
  message,
  Popconfirm,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  RobotOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  SendOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { agentService } from '../services/agent';
import type { Agent } from '../types';

const { Meta } = Card;
const { Text, Paragraph } = Typography;

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'published', label: '已发布' },
  { key: 'draft', label: '草稿' },
  { key: 'offline', label: '已下线' },
];

const STATUS_COLOR: Record<string, string> = {
  published: 'green',
  draft: 'orange',
  offline: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  published: '已发布',
  draft: '草稿',
  offline: '已下线',
};

const AgentList: React.FC = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (currentFilter) params.status = currentFilter;
      if (searchKeyword) params.keyword = searchKeyword;
      const res = await agentService.list(params);
      setAgents(res.data.data || []);
    } catch {
      message.error('加载智能体列表失败');
    } finally {
      setLoading(false);
    }
  }, [currentFilter, searchKeyword]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const stats = {
    total: agents.length,
    published: agents.filter((a) => a.status === 'published').length,
    draft: agents.filter((a) => a.status === 'draft').length,
    offline: agents.filter((a) => a.status === 'offline').length,
  };

  const handleDelete = async (id: number) => {
    try {
      await agentService.delete(id);
      message.success('智能体已删除');
      fetchAgents();
    } catch {
      message.error('删除智能体失败');
    }
  };

  const handlePublish = async (id: number) => {
    try {
      await agentService.publish(id);
      message.success('智能体已发布');
      fetchAgents();
    } catch {
      message.error('发布智能体失败');
    }
  };

  const handleOffline = async (id: number) => {
    try {
      await agentService.offline(id);
      message.success('智能体已下线');
      fetchAgents();
    } catch {
      message.error('下线智能体失败');
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Stats Bar */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="总数" value={stats.total} prefix={<RobotOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="已发布" value={stats.published} valueStyle={{ color: '#52c41a' }} prefix={<SendOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="草稿" value={stats.draft} valueStyle={{ color: '#fa8c16' }} prefix={<EditOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="已下线" value={stats.offline} valueStyle={{ color: '#999' }} prefix={<MinusCircleOutlined />} /></Card>
        </Col>
      </Row>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <Space>
          {STATUS_TABS.map((tab) => (
            <Button
              key={tab.key}
              type={currentFilter === tab.key ? 'primary' : 'default'}
              size="small"
              onClick={() => setCurrentFilter(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
        </Space>
        <Space>
          <Input
            placeholder="搜索智能体..."
            prefix={<SearchOutlined />}
            allowClear
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onPressEnter={fetchAgents}
            style={{ width: 240 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agent/create')}>
            创建智能体
          </Button>
        </Space>
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : agents.length === 0 ? (
        <Empty description="暂无智能体" />
      ) : (
        <Row gutter={[16, 16]}>
          {agents.map((agent) => (
            <Col key={agent.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onClick={() => navigate(`/agent/${agent.id}`)}
                actions={[
                  <EditOutlined key="edit" onClick={(e) => { e.stopPropagation(); navigate(`/agent/${agent.id}`); }} />,
                  <PlayCircleOutlined key="run" onClick={(e) => { e.stopPropagation(); navigate(`/agent/${agent.id}/run`); }} />,
                  agent.status === 'published' ? (
                    <MinusCircleOutlined key="offline" onClick={(e) => { e.stopPropagation(); handleOffline(agent.id); }} />
                  ) : (
                    <SendOutlined key="publish" onClick={(e) => { e.stopPropagation(); handlePublish(agent.id); }} />
                  ),
                  <Popconfirm
                    key="delete"
                    title="确定删除该智能体？"
                    onConfirm={(e) => { e?.stopPropagation(); handleDelete(agent.id); }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="确定"
                    cancelText="取消"
                  >
                    <DeleteOutlined onClick={(e) => e.stopPropagation()} />
                  </Popconfirm>,
                ]}
              >
                <Meta
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{agent.name}</span>
                      <Tag color={STATUS_COLOR[agent.status]}>{STATUS_LABEL[agent.status]}</Tag>
                    </div>
                  }
                  description={
                    <>
                      {agent.category && <Tag color="blue" style={{ marginBottom: 4 }}>{agent.category}</Tag>}
                      <Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: 4, fontSize: 12 }}>
                        {agent.description || '暂无描述'}
                      </Paragraph>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        更新于： {new Date(agent.updateTime).toLocaleDateString()}
                      </Text>
                    </>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default AgentList;
