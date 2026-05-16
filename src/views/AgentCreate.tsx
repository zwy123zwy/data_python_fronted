import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Select, Button, Upload, Typography, Space, App } from 'antd';
import { UploadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import { agentService } from '../services/agent';
import { fileUploadApi } from '../services/fileUpload';

const { Title } = Typography;
const { TextArea } = Input;

const AgentCreate: React.FC = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<UploadFile | null>(null);

  const onFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      let avatar: string | undefined;
      if (avatarFile?.originFileObj) {
        const res = await fileUploadApi.uploadAvatar(avatarFile.originFileObj);
        avatar = res.data?.url;
      }

      const data = { ...values, avatar } as Record<string, unknown>;
      await agentService.create(data as Parameters<typeof agentService.create>[0]);
      message.success('智能体创建成功');
      navigate('/agents');
    } catch {
      message.error('创建智能体失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/agents')}>返回</Button>
      </Space>
      <Card>
        <Title level={4}>创建智能体</Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ status: 'draft' }}
        >
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入智能体名称' }]}>
            <Input placeholder="智能体名称" />
          </Form.Item>

          <Form.Item name="category" label="分类">
            <Input placeholder="例如：数据分析、客服助手" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="智能体描述" />
          </Form.Item>

          <Form.Item name="prompt" label="系统提示词">
            <TextArea rows={4} placeholder="智能体的系统提示词" />
          </Form.Item>

          <Form.Item name="tags" label="标签">
            <Input placeholder="标签1, 标签2（逗号分隔）" />
          </Form.Item>

          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value="draft">草稿</Select.Option>
              <Select.Option value="published">已发布</Select.Option>
              <Select.Option value="offline">已下线</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="头像">
            <Upload
              beforeUpload={() => false}
              maxCount={1}
              listType="picture"
              accept="image/*"
              onChange={({ fileList }) => setAvatarFile(fileList[0] || null)}
            >
              <Button icon={<UploadOutlined />}>上传头像</Button>
            </Upload>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                创建智能体
              </Button>
              <Button onClick={() => navigate('/agents')}>取消</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AgentCreate;
