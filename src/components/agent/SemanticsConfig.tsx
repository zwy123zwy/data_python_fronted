import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Popconfirm, Upload } from 'antd';
import { PlusOutlined, UploadOutlined, DownloadOutlined, ImportOutlined } from '@ant-design/icons';
import { semanticModelService } from '../../services/semanticModel';
import type { SemanticModel } from '../../types';

interface Props { agentId: number }

const SemanticsConfig: React.FC<Props> = ({ agentId }) => {
  const [list, setList] = useState<SemanticModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SemanticModel | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try { const res = await semanticModelService.list(agentId, keyword); setList(res.data.data || []); }
    catch { message.error('加载失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchList(); }, [agentId, keyword]);

  const openEditor = (record?: SemanticModel) => {
    setEditing(record || null);
    form.resetFields();
    if (record) { form.setFieldsValue(record); }
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing?.id) {
        await semanticModelService.update(editing.id, values);
        message.success('已更新');
      } else {
        await semanticModelService.create({ ...values, agentId });
        message.success('已创建');
      }
      setModalOpen(false);
      fetchList();
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  const handleBatchOp = async (fn: (ids: number[]) => Promise<unknown>, label: string) => {
    if (!selectedIds.length) { message.warning('请先选择项目'); return; }
    try { await fn(selectedIds); message.success(`${label}完成`); setSelectedIds([]); fetchList(); }
    catch { message.error(`${label}失败`); }
  };

  const handleImport = async () => {
    try {
      const items = JSON.parse(importJson);
      await semanticModelService.batchImport({ agentId, items });
      message.success('导入成功');
      setImportOpen(false);
      setImportJson('');
      fetchList();
    } catch { message.error('无效的 JSON'); }
  };

  const columns = [
    { title: '表名', dataIndex: 'tableName', key: 'table' },
    { title: '列名', dataIndex: 'columnName', key: 'column' },
    { title: '业务名称', dataIndex: 'businessName', key: 'bName' },
    { title: '数据类型', dataIndex: 'dataType', key: 'dtype' },
    { title: '状态', dataIndex: 'status', key: 'status', render: (v: string) => v },
    {
      title: '操作', key: 'actions', render: (_: unknown, r: SemanticModel) => (
        <Space>
          <Button size="small" onClick={() => openEditor(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => semanticModelService.delete(r.id).then(fetchList)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => openEditor()}>添加</Button>
        <Button onClick={() => handleBatchOp(ids => semanticModelService.enable(ids), '启用')}>批量启用</Button>
        <Button onClick={() => handleBatchOp(ids => semanticModelService.disable(ids), '禁用')}>批量禁用</Button>
        <Button danger onClick={() => handleBatchOp(ids => semanticModelService.batchDelete(ids), '删除')}>批量删除</Button>
        <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>导入 JSON</Button>
        <Upload beforeUpload={async (file) => {
          const fd = new FormData(); fd.append('file', file);
          try { await semanticModelService.importExcel(fd); message.success('导入成功'); fetchList(); }
          catch { message.error('导入失败'); }
          return false;
        }} showUploadList={false} accept=".xlsx,.xls">
          <Button icon={<UploadOutlined />}>导入 Excel</Button>
        </Upload>
        <Button icon={<DownloadOutlined />} onClick={async () => {
          try { const res = await semanticModelService.downloadTemplate(); const url = URL.createObjectURL(res.data as Blob); const a = document.createElement('a'); a.href = url; a.download = 'template.xlsx'; a.click(); URL.revokeObjectURL(url); }
          catch { message.error('下载失败'); }
        }}>下载模板</Button>
        <Input.Search placeholder="搜索..." style={{ width: 200 }} onSearch={(v) => setKeyword(v)} allowClear />
      </Space>
      <Table
        rowKey="id" columns={columns} dataSource={list} loading={loading}
        rowSelection={{ selectedRowKeys: selectedIds, onChange: (keys) => setSelectedIds(keys as number[]) }}
        pagination={{ pageSize: 15 }}
      />

      <Modal title={editing ? '编辑' : '添加'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave} confirmLoading={saving}>
        <Form form={form} layout="vertical">
          <Form.Item name="tableName" label="表名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="columnName" label="列名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="businessName" label="业务名称"><Input /></Form.Item>
          <Form.Item name="synonyms" label="同义词"><Input placeholder="逗号分隔" /></Form.Item>
          <Form.Item name="businessDescription" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="dataType" label="数据类型"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title="导入 JSON" open={importOpen} onCancel={() => setImportOpen(false)} onOk={handleImport}>
        <Input.TextArea rows={8} value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder='[{"tableName":"","columnName":"","businessName":""}]' />
      </Modal>
    </div>
  );
};

export default SemanticsConfig;
