import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Switch, Popconfirm, App, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { presetQuestionService } from '../../services/presetQuestion';
import type { PresetQuestion, PresetQuestionDTO } from '../../types';

const { Title } = Typography;
const { TextArea } = Input;

interface Props { agentId: number }

const PresetsConfig: React.FC<Props> = ({ agentId }) => {
  const { message } = App.useApp();
  const [questions, setQuestions] = useState<PresetQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formRef] = Form.useForm();

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await presetQuestionService.list(agentId);
      setQuestions((res.data.data || []) as PresetQuestion[]);
    } catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, [agentId]);

  const openCreate = () => {
    setEditingId(null);
    formRef.resetFields();
    formRef.setFieldsValue({ question: '', sortOrder: 0, isActive: true });
    setDialogOpen(true);
  };

  const openEdit = (q: PresetQuestion) => {
    setEditingId(q.id);
    formRef.setFieldsValue({ question: q.question, sortOrder: q.sortOrder, isActive: q.isActive });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await presetQuestionService.delete(agentId, id);
      message.success('删除成功');
      fetchList();
    } catch { message.error('删除失败'); }
  };

  // Convert boolean (from Switch) to 1|0 for backend
  const toActiveNum = (v: boolean | number): number => (v ? 1 : 0);

  const handleSave = async () => {
    const values = await formRef.validateFields().catch(() => null);
    if (!values) return;
    setSaving(true);
    try {
      let dtos: PresetQuestionDTO[];
      if (editingId) {
        dtos = questions.map((q) => ({
          question: q.id === editingId ? values.question : q.question,
          sortOrder: q.id === editingId ? values.sortOrder : q.sortOrder,
          isActive: q.id === editingId ? toActiveNum(values.isActive) : toActiveNum(q.isActive),
        }));
      } else {
        dtos = [
          ...questions.map((q) => ({ question: q.question, sortOrder: q.sortOrder, isActive: toActiveNum(q.isActive) })),
          { question: values.question, sortOrder: values.sortOrder, isActive: toActiveNum(values.isActive) },
        ];
      }
      await presetQuestionService.batchSave(agentId, dtos);
      message.success(editingId ? '更新成功' : '创建成功');
      setDialogOpen(false);
      fetchList();
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ padding: 20 }}>
      <Title level={4}>预设问题管理</Title>
      <div style={{ margin: '16px 0', borderTop: '1px solid #f0f0f0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0 }}>预设问题列表</Title>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreate}>
          添加问题
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={questions}
        columns={[
          { title: 'ID', dataIndex: 'id', width: 80 },
          { title: '问题', dataIndex: 'question', ellipsis: true },
          { title: '排序', dataIndex: 'sortOrder', width: 80 },
          {
            title: '状态', dataIndex: 'isActive', width: 80,
            render: (v: boolean | number) => (
              <Tag color={v ? 'success' : 'default'}>{v ? '启用' : '禁用'}</Tag>
            ),
          },
          { title: '创建时间', dataIndex: 'createTime', width: 160 },
          {
            title: '操作', width: 180,
            render: (_: unknown, record: PresetQuestion) => (
              <Space>
                <Button type="primary" size="small" onClick={() => openEdit(record)}>编辑</Button>
                <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
                  <Button danger size="small">删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingId ? '编辑预设问题' : '添加预设问题'}
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={formRef} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="问题" name="question" rules={[{ required: true, message: '请输入预设问题' }]}>
            <TextArea rows={4} placeholder="请输入预设问题" />
          </Form.Item>
          <Form.Item label="排序" name="sortOrder">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PresetsConfig;
