import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, Button, Space, Table, App } from 'antd';
import { datasourceService } from '../../services/datasource';
import { agentDatasourceService } from '../../services/agentDatasource';
import type { Datasource } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  agentId: number;
  onAdded: () => void;
}

const DatasourceManageModal: React.FC<Props> = ({ open, onClose, agentId, onAdded }) => {
  const { message } = App.useApp();
  const [datasources, setDatasources] = useState<Datasource[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try { const res = await datasourceService.list(); setDatasources(res.data.data || []); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) { fetchList(); setShowCreate(false); } }, [open]);

  const handleAdd = async (datasourceId: number) => {
    try {
      await agentDatasourceService.addToAgent(agentId, datasourceId);
      message.success('数据源已添加');
      onAdded();
      onClose();
    } catch { message.error('添加失败'); }
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await datasourceService.create(values);
      message.success('数据源已创建');
      setShowCreate(false);
      form.resetFields();
      fetchList();
    } catch { message.error('创建失败'); }
    finally { setSaving(false); }
  };

  const handleTest = async (id: number) => {
    try {
      await datasourceService.testConnection(id);
      message.success('连接成功');
    } catch { message.error('连接失败'); }
  };

  return (
    <Modal title="添加数据源" open={open} onCancel={onClose} footer={null} width={800}>
      <Space style={{ marginBottom: 16 }}>
        <Button type={showCreate ? 'default' : 'primary'} onClick={() => setShowCreate(false)}>已有数据源</Button>
        <Button type={showCreate ? 'primary' : 'default'} onClick={() => setShowCreate(true)}>新建数据源</Button>
      </Space>

      {showCreate ? (
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}><Input placeholder="例如：mysql" /></Form.Item>
          <Form.Item name="host" label="主机" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="port" label="端口" rules={[{ required: true }]}><InputNumber min={1} max={65535} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="databaseName" label="数据库" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="password" label="密码"><Input.Password /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" onClick={handleCreate} loading={saving}>创建</Button>
        </Form>
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          dataSource={datasources}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '类型', dataIndex: 'type' },
            { title: '主机', dataIndex: 'host' },
            { title: '数据库', dataIndex: 'databaseName' },
            {
              title: '操作', render: (_: unknown, r: Datasource) => (
                <Space>
                  <Button size="small" onClick={() => handleAdd(r.id)}>添加</Button>
                  <Button size="small" onClick={() => handleTest(r.id)}>测试</Button>
                </Space>
              ),
            },
          ]}
          pagination={false}
        />
      )}
    </Modal>
  );
};

export default DatasourceManageModal;
