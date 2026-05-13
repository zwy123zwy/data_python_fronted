import React from 'react';
import { Layout, Button, theme } from 'antd';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  RobotOutlined,
  SettingOutlined,
  PlusOutlined,
} from '@ant-design/icons';

const { Header, Content } = Layout;

interface BaseLayoutProps {
  children: React.ReactNode;
}

function BaseLayout({ children }: BaseLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const isAgentRunPage = location.pathname.includes('/run');

  const handleBackToHome = () => navigate('/agents');

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          padding: '0 24px',
          height: 56,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link
            to="/agents"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontWeight: 600,
              fontSize: 16,
              color: token.colorPrimary,
              textDecoration: 'none',
            }}
          >
            <RobotOutlined style={{ fontSize: 20 }} />
            数据智能体平台
          </Link>
          <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/agent/create')}>
            Create Agent → 创建智能体
          </Button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            size="small"
            type="text"
            icon={<SettingOutlined />}
            onClick={() => navigate('/model-config')}
          />
          <Button size="small" type="text" onClick={handleBackToHome}>
          首页
          </Button>
        </div>
      </Header>
      <Layout>
        <Content
          style={{
            padding: isAgentRunPage ? 0 : 24,
            background: token.colorBgLayout,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

export default BaseLayout;
