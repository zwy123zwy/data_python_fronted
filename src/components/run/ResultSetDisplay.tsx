import React, { useState, useMemo } from 'react';
import { Table, Button, Space } from 'antd';
import { TableOutlined, BarChartOutlined } from '@ant-design/icons';
import type { ResultData, PaginationConfig } from '../../types';
import ChartComponent from './ChartComponent';

interface Props {
  resultData: ResultData;
  pageSize?: number;
}

const ResultSetDisplay: React.FC<Props> = ({ resultData, pageSize = 100 }) => {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
  const [pagination, setPagination] = useState<PaginationConfig>({ currentPage: 1, pageSize, total: 0 });

  const { resultSet, displayStyle } = resultData;

  const dataSource = resultSet?.data || [];
  const rawColumns = resultSet?.columns || [];
  // 后端可能返回字符串数组或 [{name, comment, ...}] 对象数组
  const columns: string[] = rawColumns.map((col: unknown) =>
    typeof col === 'string' ? col : (col as Record<string, string>).name || String(col),
  );

  // ECharts-compatible chart data
  const canShowChart = !!displayStyle && columns.length > 0 && dataSource.length > 0;

  const tableColumns = useMemo(() =>
    columns.map((col) => ({
      title: col,
      dataIndex: col,
      key: col,
      ellipsis: true,
      render: (text: string) => (
        <span
          style={{ cursor: 'pointer', fontSize: 13 }}
          onClick={() => { navigator.clipboard.writeText(text); }}
          title="点击复制"
        >
          {text}
        </span>
      ),
    })),
    [columns],
  );

  return (
    <div style={{ marginBottom: 12 }}>
      {canShowChart && (
        <Space style={{ marginBottom: 8 }}>
          <Button size="small" type={viewMode === 'table' ? 'primary' : 'default'} icon={<TableOutlined />} onClick={() => setViewMode('table')}>表格</Button>
          <Button size="small" type={viewMode === 'chart' ? 'primary' : 'default'} icon={<BarChartOutlined />} onClick={() => setViewMode('chart')}>图表</Button>
        </Space>
      )}

      {viewMode === 'chart' && canShowChart ? (
        <ChartComponent resultData={resultData} />
      ) : (
        <Table
          rowKey={(_, i) => String(i)}
          columns={tableColumns}
          dataSource={dataSource}
          pagination={{
            pageSize: pagination.pageSize,
            current: pagination.currentPage,
            total: pagination.total || dataSource.length,
            showTotal: (total) => `共 ${total} 行`,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
            onChange: (page, size) => setPagination({ currentPage: page, pageSize: size, total: dataSource.length }),
          }}
          size="small"
          scroll={{ x: 'max-content' }}
          bordered
        />
      )}
    </div>
  );
};

export default ResultSetDisplay;
