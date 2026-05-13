import React, { useEffect, useState } from 'react';
import { Modal, Table, Button, Select, Space, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { logicalRelationService } from '../../services/logicalRelation';
import type { LogicalRelation } from '../../types';

interface Props {
  open: boolean;
  datasourceId: number;
  onClose: () => void;
}

const LogicalRelationModal: React.FC<Props> = ({ open, datasourceId, onClose }) => {
  const [relations, setRelations] = useState<Partial<LogicalRelation>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      logicalRelationService.list(datasourceId)
        .then((res) => setRelations(res.data.data || []))
        .catch(() => message.error('加载失败'))
        .finally(() => setLoading(false));
    }
  }, [open, datasourceId]);

  const handleAdd = () => {
    setRelations([...relations, { sourceTableName: '', sourceColumnName: '', targetTableName: '', targetColumnName: '', relationType: '1:1' }]);
  };

  const handleChange = (index: number, field: string, value: string) => {
    const updated = [...relations];
    updated[index] = { ...updated[index], [field]: value };
    setRelations(updated);
  };

  const handleDelete = (index: number) => {
    setRelations(relations.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      await logicalRelationService.batchSave(datasourceId, relations);
      message.success('关联已保存');
      onClose();
    } catch { message.error('保存失败'); }
  };

  const columns = [
    {
      title: '源表.列', render: (_: unknown, r: Partial<LogicalRelation>, i: number) => (
        <Space>
          <Select style={{ width: 140 }} value={r.sourceTableName} onChange={(v) => handleChange(i, 'sourceTableName', v)} placeholder="表">
            {[...new Set(relations.map((x) => x.sourceTableName).filter(Boolean))].map((t) => (
              <Select.Option key={t} value={t}>{t}</Select.Option>
            ))}
          </Select>
          <Select style={{ width: 140 }} value={r.sourceColumnName} onChange={(v) => handleChange(i, 'sourceColumnName', v)} placeholder="列" />
        </Space>
      ),
    },
    {
      title: '关联', render: (_: unknown, r: Partial<LogicalRelation>, i: number) => (
        <Select style={{ width: 80 }} value={r.relationType} onChange={(v) => handleChange(i, 'relationType', v)}>
          <Select.Option value="1:1">1:1</Select.Option>
          <Select.Option value="1:N">1:N</Select.Option>
          <Select.Option value="N:1">N:1</Select.Option>
        </Select>
      ),
    },
    {
      title: '目标表.列', render: (_: unknown, r: Partial<LogicalRelation>, i: number) => (
        <Space>
          <Select style={{ width: 140 }} value={r.targetTableName} onChange={(v) => handleChange(i, 'targetTableName', v)} placeholder="表">
            {[...new Set(relations.map((x) => x.targetTableName).filter(Boolean))].map((t) => (
              <Select.Option key={t} value={t}>{t}</Select.Option>
            ))}
          </Select>
          <Select style={{ width: 140 }} value={r.targetColumnName} onChange={(v) => handleChange(i, 'targetColumnName', v)} placeholder="列" />
        </Space>
      ),
    },
    {
      title: '', render: (_: unknown, __: unknown, i: number) => (
        <Popconfirm title="确定移除？" onConfirm={() => handleDelete(i)}><Button size="small" danger>×</Button></Popconfirm>
      ),
    },
  ];

  return (
    <Modal title="逻辑关联" open={open} onCancel={onClose} onOk={handleSave} width={900}>
      <Button icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>添加关联</Button>
      <Table rowKey={(_, i) => String(i)} columns={columns} dataSource={relations} loading={loading} pagination={false} />
    </Modal>
  );
};

export default LogicalRelationModal;
