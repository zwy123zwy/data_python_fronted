import * as echarts from 'echarts';

export type ChartType = 'table' | 'bar' | 'column' | 'line' | 'pie';

export const COLOR_PANEL = ['#5584FF', '#36CBCB', '#4ECB74', '#FAD337', '#F2637B', '#975FEE'];

export interface ChartAxis {
  name: string;
  value: string;
  type?: 'x' | 'y' | 'series';
}

export function generateRandomColor(): string {
  return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
}

export function generateUniqueColors(count: number): string[] {
  const colors: string[] = [];
  const usedColors = new Set<string>();
  const palette = [...COLOR_PANEL, '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];
  for (let i = 0; i < count; i++) {
    let color: string;
    if (i < palette.length) {
      color = palette[i];
      if (usedColors.has(color)) {
        do { color = generateRandomColor(); } while (usedColors.has(color));
      }
    } else {
      do { color = generateRandomColor(); } while (usedColors.has(color));
    }
    colors.push(color);
    usedColors.add(color);
  }
  return colors;
}

export function createChartOption(
  chartType: ChartType,
  axis: ChartAxis[],
  data: Record<string, unknown>[],
  title?: string,
): echarts.EChartsOption {
  const xAxisConfig = axis.find((a) => a.type === 'x') || axis[0];
  const yAxes = axis.filter((a) => a.type === 'y');
  const xData = data.map((item) => String(item[xAxisConfig?.value] || ''));

  if (chartType === 'pie') {
    const colors = generateUniqueColors(data.length);
    return {
      title: { text: title || '', left: 'center', textStyle: { fontSize: 14 } },
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { orient: 'horizontal', bottom: 0 },
      series: [{
        type: 'pie', radius: '50%',
        data: data.map((item, i) => ({
          name: String(item[xAxisConfig?.value] || ''),
          value: parseFloat(String(item[yAxes[0]?.value] || '0')) || 0,
          itemStyle: { color: colors[i] },
        })),
      }],
    };
  }

  const colors = generateUniqueColors(yAxes.length || 1);
  return {
    title: { text: title || '', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { data: yAxes.map((a) => a.name), bottom: 0 },
    xAxis: { type: 'category', data: xData, axisLabel: { rotate: xData.length > 10 ? 45 : 0 } },
    yAxis: { type: 'value' },
    series: yAxes.map((yAxis, i) => ({
      name: yAxis.name,
      type: chartType === 'line' ? 'line' : 'bar',
      data: data.map((item) => {
        const val = item[yAxis.value];
        return isNaN(Number(val)) ? val : Number(val);
      }),
      color: colors[i],
      ...(chartType === 'line' ? { smooth: true } : {}),
      ...(chartType === 'bar' || chartType === 'column' ? { barMaxWidth: 40 } : {}),
    })),
  };
}
