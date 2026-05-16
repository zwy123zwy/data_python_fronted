import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Switch, Popconfirm, App } from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, TableOutlined } from '@ant-design/icons';
import { agentDatasourceService } from '../../services/agentDatasource';
import type { AgentDatasource } from '../../types';
import DatasourceManageModal from './DatasourceManageModal';
import TableSelectModal from './TableSelectModal';
import LogicalRelationModal from './LogicalRelationModal';

interface DataSourceConfigProps {
  agentId: number;
}

const DataSourceConfig: React.FC<DataSourceConfigProps> = ({ agentId }) => {
  const { message } = App.useApp();
  const [dataSources, setDataSources] = useState<AgentDatasource[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [tableModalDs, setTableModalDs] = useState<AgentDatasource | null>(null);
  const [relationModalDs, setRelationModalDs] = useState<AgentDatasource | null>(null);

  const fetchDataSources = async () => {
    setLoading(true);
    try {
      const res = await agentDatasourceService.getByAgent(agentId);
      setDataSources(res.data.data || []);
    } catch { message.error('加载数据源失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDataSources(); }, [agentId]);

  const handleRemove = async (dsId: number) => {
    try {
      await agentDatasourceService.removeFromAgent(agentId, dsId);
      message.success('数据源已移除');
      fetchDataSources();
    } catch { message.error('移除数据源失败'); }
  };

  const handleToggleActive = async (ds: AgentDatasource) => {
    try {
      await agentDatasourceService.toggleActive(agentId, { datasourceId: ds.datasourceId, isActive: !ds.isActive });
      message.success(ds.isActive ? '数据源已停用' : '数据源已激活');
      fetchDataSources();
    } catch { message.error('切换失败'); }
  };

  const handleInitSchema = async () => {
    try {
      await agentDatasourceService.initSchema(agentId);
      message.success('Schema 已初始化');
      fetchDataSources();
    } catch { message.error('初始化 Schema 失败'); }
  };

  const columns = [
    { title: '名称', dataIndex: ['datasource', 'name'], key: 'name' },
    { title: '类型', dataIndex: ['datasource', 'type'], key: 'type' },
    { title: '主机', dataIndex: ['datasource', 'host'], key: 'host' },
    { title: '数据库', dataIndex: ['datasource', 'databaseName'], key: 'db' },
    {
      title: '活跃', key: 'active', render: (_: unknown, r: AgentDatasource) => (
        <Switch checked={r.isActive} onChange={() => handleToggleActive(r)} />
      ),
    },
    {
      title: '表', key: 'tables', render: (_: unknown, r: AgentDatasource) => (
        <Space>
          <Tag>{r.selectTables?.length || 0} 张表</Tag>
          <Button size="small" icon={<TableOutlined />} onClick={() => setTableModalDs(r)}>选择</Button>
        </Space>
      ),
    },
    {
      title: '操作', key: 'actions', render: (_: unknown, r: AgentDatasource) => (
        <Space>
          <Button size="small" onClick={() => setRelationModalDs(r)}>关联关系</Button>
          <Popconfirm title="确定移除？" onConfirm={() => handleRemove(r.datasourceId)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setAddModalVisible(true)}>添加数据源</Button>
        <Button icon={<ReloadOutlined />} onClick={handleInitSchema}>初始化 Schema</Button>
      </Space>
      <Table rowKey="id" columns={columns} dataSource={dataSources} loading={loading} pagination={false} />

      <DatasourceManageModal
        open={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        agentId={agentId}
        onAdded={fetchDataSources}
      />
      {tableModalDs && (
        <TableSelectModal
          open={!!tableModalDs}
          agentId={agentId}
          datasource={tableModalDs}
          onClose={() => setTableModalDs(null)}
          onSaved={fetchDataSources}
        />
      )}
      {relationModalDs && (
        <LogicalRelationModal
          open={!!relationModalDs}
          datasourceId={relationModalDs.datasourceId}
          onClose={() => setRelationModalDs(null)}
        />
      )}
    </div>
  );
};

export default DataSourceConfig;
