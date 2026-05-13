import React, { useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import type { ResultData } from '../../types';

interface Props {
  resultData: ResultData;
}

const ChartComponent: React.FC<Props> = ({ resultData }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || !resultData.resultSet || !resultData.displayStyle) return;

    if (instanceRef.current) {
      instanceRef.current.dispose();
    }

    const chart = echarts.init(chartRef.current);
    instanceRef.current = chart;

    const { resultSet, displayStyle } = resultData;
    const { data } = resultSet;
    const rawColumns = resultSet.columns || [];
    // 后端可能返回字符串或 {name, comment, ...} 对象
    const columns = rawColumns.map((col: unknown) =>
      typeof col === 'string' ? col : (col as Record<string, string>).name || String(col),
    );
    const { type, title, x, y } = displayStyle;

    const xField = x || columns[0];
    const yFields = y || columns.slice(1);

    const option: echarts.EChartsOption = {
      title: { text: title || '', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'axis' },
      legend: { data: yFields, bottom: 0 },
      xAxis: { type: 'category', data: data.map((row) => row[xField]), axisLabel: { rotate: 30 } },
      yAxis: { type: 'value' },
      series: yFields.map((field) => ({
        name: field,
        type: type === 'bar' ? 'bar' : type === 'line' ? 'line' : type === 'pie' ? 'pie' : 'bar',
        data: data.map((row) => row[field]),
      })),
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [resultData]);

  return <div ref={chartRef} style={{ width: '100%', height: 350 }} />;
};

export default ChartComponent;
