import React, { useState } from 'react';
import { Timeline, Typography } from 'antd';
import {
  SearchOutlined,
  BookOutlined,
  DatabaseOutlined,
  ThunderboltOutlined,
  ScheduleOutlined,
  CheckCircleOutlined,
  CheckCircleFilled,
  ConsoleSqlOutlined,
  BranchesOutlined,
  LinkOutlined,
  CodeOutlined,
  RocketOutlined,
  BarChartOutlined,
  ControlOutlined,
  FileTextOutlined,
  NodeIndexOutlined,
  LoadingOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import type MarkdownIt from 'markdown-it';
import { formatNodeContent } from '../../utils/nodeFormat';
import ResultSetDisplay from './ResultSetDisplay';
import ReportHtmlView from './ReportHtmlView';
import type { GraphNodeResponse, ResultData } from '../../types';

const { Text } = Typography;

// ---- 节点名 → 中文标签 + 语义图标 ----
const NODE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  IntentRecognitionNode: { label: '分析用户意图', icon: <SearchOutlined /> },
  EvidenceRecallNode: { label: '检索知识库', icon: <BookOutlined /> },
  SchemaRecallNode: { label: '分析数据表结构', icon: <DatabaseOutlined /> },
  TableRelationNode: { label: '分析表关系', icon: <LinkOutlined /> },
  QueryEnhanceNode: { label: '优化查询', icon: <ThunderboltOutlined /> },
  PlannerNode: { label: '制定执行计划', icon: <ScheduleOutlined /> },
  FeasibilityAssessmentNode: { label: '评估可行性', icon: <CheckCircleOutlined /> },
  HumanFeedbackNode: { label: '等待人工确认', icon: <UserSwitchOutlined /> },
  SqlGenerateNode: { label: '生成 SQL', icon: <ConsoleSqlOutlined /> },
  SqlExecuteNode: { label: '执行 SQL', icon: <BranchesOutlined /> },
  SemanticConsistencyNode: { label: '语义一致性检查', icon: <LinkOutlined /> },
  PythonGenerateNode: { label: '生成分析代码', icon: <CodeOutlined /> },
  PythonExecuteNode: { label: '执行分析代码', icon: <RocketOutlined /> },
  PythonAnalyzeNode: { label: '分析执行结果', icon: <BarChartOutlined /> },
  PlanExecutorNode: { label: '执行计划', icon: <ControlOutlined /> },
  ReportGeneratorNode: { label: '生成报告', icon: <FileTextOutlined /> },
};

// ---- 未匹配节点用原始 nodeName 兜底 ----
function getNodeMeta(nodeName: string): { label: string; icon: React.ReactNode } {
  return NODE_META[nodeName] || { label: nodeName, icon: <NodeIndexOutlined /> };
}

// ---- 判断是否始终展开（结果集和报告节点不折叠） ----
function isAlwaysExpanded(block: GraphNodeResponse[]): boolean {
  if (!block.length) return false;
  const first = block[0];
  return (
    first.textType === 'RESULT_SET' ||
    (first.nodeName === 'ReportGeneratorNode' && first.textType === 'MARK_DOWN')
  );
}

interface Props {
  nodeBlocks: GraphNodeResponse[][];
  isStreaming: boolean;
  showSqlResults: boolean;
  pageSize: number;
  reportFormat: 'markdown' | 'html';
  mdRef: React.MutableRefObject<MarkdownIt>;
  onGetMarkdownFromBlock: (nodes: GraphNodeResponse[]) => string;
}

const ChainOfThought: React.FC<Props> = ({
  nodeBlocks,
  isStreaming,
  showSqlResults,
  pageSize,
  reportFormat,
  mdRef,
  onGetMarkdownFromBlock,
}) => {
  // 手动展开/折叠状态，默认全部折叠（最后一个和特殊节点除外）
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());

  if (!nodeBlocks.length) return null;

  const lastIndex = nodeBlocks.length - 1;

  const toggleBlock = (index: number) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const items = nodeBlocks.map((block, i) => {
    if (!block || !block.length) return null;
    const first = block[0];
    const meta = getNodeMeta(first.nodeName);
    const isLast = i === lastIndex;
    const alwaysOpen = isAlwaysExpanded(block);
    // 是否展开：最后一个 | 始终展开 | 手动展开
    const expanded = isLast || alwaysOpen || expandedBlocks.has(i);

    // 状态色 & dot 图标
    const isProcessing = isLast && isStreaming;
    const color = isProcessing ? 'blue' : 'green';
    const dot = isProcessing ? (
      <LoadingOutlined spin style={{ color: '#1677ff' }} />
    ) : (
      <CheckCircleFilled style={{ color: '#52c41a' }} />
    );

    return {
      key: i,
      color,
      dot,
      children: (
        <div>
          {/* 标题行：中文标签 + 原始节点名 + 展开/折叠箭头 */}
          <div
            onClick={() => {
              if (!alwaysOpen && !isLast) toggleBlock(i);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: !alwaysOpen && !isLast ? 'pointer' : 'default',
              userSelect: 'none',
              padding: '4px 0',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: isProcessing ? '#1677ff' : '#303133' }}>
              {meta.label}
            </span>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {first.nodeName}
            </Text>
            {!alwaysOpen && !isLast && (
              expanded ? (
                <CaretDownOutlined style={{ fontSize: 12, color: '#bfbfbf' }} />
              ) : (
                <CaretRightOutlined style={{ fontSize: 12, color: '#bfbfbf' }} />
              )
            )}
          </div>

          {/* 内容区 */}
          {expanded && (
            <div style={{ paddingTop: 8 }}>
              {/* ReportGeneratorNode + MARK_DOWN → 报告实时预览 */}
              {first.nodeName === 'ReportGeneratorNode' && first.textType === 'MARK_DOWN' ? (
                reportFormat === 'markdown' ? (
                  <div
                    className="html-rendered-content"
                    dangerouslySetInnerHTML={{
                      __html: mdRef.current.render(onGetMarkdownFromBlock(block)),
                    }}
                  />
                ) : (
                  <ReportHtmlView content={onGetMarkdownFromBlock(block)} />
                )
              ) : first.textType === 'RESULT_SET' ? (
                /* RESULT_SET → 结果集表格 */
                (() => {
                  try {
                    const rd = JSON.parse(first.text) as ResultData;
                    return <ResultSetDisplay resultData={rd} pageSize={pageSize} />;
                  } catch {
                    return <pre>{first.text}</pre>;
                  }
                })()
              ) : (
                /* 默认：通过 formatNodeContent 生成 HTML（无重复标题栏） */
                <div
                  dangerouslySetInnerHTML={{
                    __html: formatNodeContent(block, showSqlResults, pageSize),
                  }}
                />
              )}
            </div>
          )}
        </div>
      ),
    };
  });

  return (
    <div
      className="chain-of-thought"
      style={{
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        padding: '16px 20px',
      }}
    >
      {/* 思考链头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        {isStreaming ? (
          <>
            <LoadingOutlined spin style={{ color: '#1677ff', fontSize: 16 }} />
            <span style={{ fontWeight: 600, color: '#1677ff', fontSize: 15 }}>思考中...</span>
          </>
        ) : (
          <>
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 16 }} />
            <span style={{ fontWeight: 600, color: '#52c41a', fontSize: 15 }}>思考完成</span>
          </>
        )}
      </div>

      {/* Timeline 思维链 */}
      <Timeline items={items.filter(Boolean) as any} />

      {/* 折叠提示 */}
      {lastIndex > 0 && (
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            点击步骤标题可展开/折叠详情
          </Text>
        </div>
      )}
    </div>
  );
};

export default ChainOfThought;
