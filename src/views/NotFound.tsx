import React from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title="404"
      subTitle="页面未找到"
      extra={
        <Button type="primary" onClick={() => navigate('/agents')}>
          返回首页
        </Button>
      }
    />
  );
};

export default NotFound;
