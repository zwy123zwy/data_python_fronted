import React, { useEffect, useState } from 'react';
import { Modal, Checkbox, Button, Space, Spin, App } from 'antd';
import { datasourceService } from '../../services/datasource';
import { agentDatasourceService } from '../../services/agentDatasource';
import type { AgentDatasource } from '../../types';

interface Props {
  open: boolean;
  agentId: number;
  datasource: AgentDatasource;
  onClose: () => void;
  onSaved: () => void;
}

const TableSelectModal: React.FC<Props> = ({ open, agentId, datasource, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [allTables, setAllTables] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(datasource.selectTables || []);
      fetchTables();
    }
  }, [open]);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const res = await datasourceService.getTableList(datasource.datasourceId);
      const raw = res.data.data || [];
      // 后端返回 [{name, comment}, ...] 对象数组，提取表名
      const tables = raw.map((item: string | { name: string }) =>
        typeof item === 'string' ? item : item.name,
      );
      setAllTables(tables);
    } catch { message.error('加载表列表失败'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await agentDatasourceService.updateSelectedTables(agentId, {
        datasourceId: datasource.datasourceId,
        tables: selected,
      });
      message.success('表已更新');
      onSaved();
      onClose();
    } catch { message.error('保存失败'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="选择表" open={open} onCancel={onClose} footer={null} width={400}>
      {loading ? <Spin /> : (
        <>
          <Checkbox.Group value={selected} onChange={(v) => setSelected(v as string[])} style={{ width: '100%' }}>
            <Space direction="vertical">
              {allTables.map((t) => (
                <Checkbox key={t} value={t}>{t}</Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={handleSave} loading={saving}>保存</Button>
          </div>
        </>
      )}
    </Modal>
  );
};

export default TableSelectModal;
