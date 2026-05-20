/**
 * [阶段5] V2 思考 — 可折叠 Timeline，展开显示步骤正文 / SQL / 结果表
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Timeline } from 'antd';
import { CaretDownOutlined, CaretRightOutlined, LoadingOutlined } from '@ant-design/icons';
import type { V2TimelineEntry } from '../../types/v2Timeline';
import ResultSetDisplay from './ResultSetDisplay';
import type { ResultData } from '../../types';

interface Props {
  entries: V2TimelineEntry[];
  isStreaming?: boolean;
  pageSize?: number;
}

function statusColor(status: V2TimelineEntry['status']): string {
  if (status === 'running') return '#1677ff';
  if (status === 'error') return '#ff4d4f';
  return '#bfbfbf';
}

function StepContent({ entry, pageSize }: { entry: V2TimelineEntry; pageSize: number }) {
  const { content, contentType, detail } = entry;
  if (!content && !detail) {
    return (
      <div style={{ fontSize: 12, color: '#bfbfbf', fontStyle: 'italic' }}>
        暂无详细输出
      </div>
    );
  }

  if (contentType === 'result_set' && content) {
    try {
      const rd = JSON.parse(content) as ResultData;
      return <ResultSetDisplay resultData={rd} pageSize={pageSize} />;
    } catch {
      return <pre style={preStyle}>{content}</pre>;
    }
  }

  if (contentType === 'sql' && content) {
    return <pre style={preStyle}>{content}</pre>;
  }

  const body = content || detail || '';
  return (
    <div
      style={{
        fontSize: 12,
        color: '#595959',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {body}
    </div>
  );
}

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: '8px 10px',
  background: '#fff',
  border: '1px solid #e8e8e8',
  borderRadius: 6,
  fontSize: 12,
  lineHeight: 1.5,
  overflow: 'auto',
  maxHeight: 280,
};

const V2ThinkingTimeline: React.FC<Props> = ({
  entries,
  isStreaming = false,
  pageSize = 10,
}) => {
  const [panelOpen, setPanelOpen] = useState(true);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  const runningId = useMemo(
    () => entries.find((e) => e.status === 'running')?.id,
    [entries],
  );

  useEffect(() => {
    if (isStreaming) setPanelOpen(true);
  }, [isStreaming]);

  useEffect(() => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (runningId) next.add(runningId);
      const last = entries[entries.length - 1];
      if (last && (last.content || last.detail)) next.add(last.id);
      return next;
    });
  }, [entries, runningId]);

  if (!entries.length) return null;

  const toggleStep = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const doneCount = entries.filter((e) => e.status === 'ok').length;

  return (
    <div
      className="v2-thinking-timeline"
      style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}
    >
      <div
        style={{
          maxWidth: '88%',
          width: '100%',
          padding: '10px 14px',
          borderRadius: 10,
          background: '#f5f7fa',
          border: '1px dashed #d9d9d9',
        }}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => setPanelOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setPanelOpen((o) => !o);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: 12,
            color: '#8c8c8c',
            fontWeight: 500,
            marginBottom: panelOpen ? 8 : 0,
          }}
        >
          {panelOpen ? (
            <CaretDownOutlined style={{ fontSize: 11 }} />
          ) : (
            <CaretRightOutlined style={{ fontSize: 11 }} />
          )}
          <span>{'\uD83E\uDDE0 思考过程'}</span>
          <span style={{ color: '#bfbfbf', fontWeight: 400 }}>
            {`(${doneCount}/${entries.length} 步${isStreaming ? ' · 进行中' : ''})`}
          </span>
        </div>

        {panelOpen && (
          <Timeline
            style={{ marginTop: 4, marginBottom: 0 }}
            items={entries.map((entry) => {
              const hasBody = Boolean(entry.content || entry.detail);
              const stepOpen = expandedSteps.has(entry.id);
              return {
                color: statusColor(entry.status),
                dot:
                  entry.status === 'running' ? (
                    <LoadingOutlined style={{ fontSize: 12 }} />
                  ) : undefined,
                children: (
                  <div key={entry.id}>
                    <div
                      role={hasBody ? 'button' : undefined}
                      tabIndex={hasBody ? 0 : undefined}
                      onClick={hasBody ? () => toggleStep(entry.id) : undefined}
                      onKeyDown={
                        hasBody
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') toggleStep(entry.id);
                            }
                          : undefined
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 6,
                        cursor: hasBody ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                    >
                      {hasBody && (
                        stepOpen ? (
                          <CaretDownOutlined style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }} />
                        ) : (
                          <CaretRightOutlined style={{ fontSize: 11, color: '#bfbfbf', marginTop: 4 }} />
                        )
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#595959', lineHeight: 1.5 }}>
                          {entry.agentName && (
                            <span style={{ color: '#1677ff', marginRight: 6, fontSize: 12 }}>
                              [{entry.agentName}]
                            </span>
                          )}
                          {entry.title}
                        </div>
                        {!stepOpen && entry.detail && (
                          <div
                            style={{
                              marginTop: 2,
                              fontSize: 12,
                              color: '#8c8c8c',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry.detail}
                          </div>
                        )}
                      </div>
                    </div>
                    {stepOpen && hasBody && (
                      <div style={{ marginTop: 8, marginLeft: hasBody ? 17 : 0 }}>
                        <StepContent entry={entry} pageSize={pageSize} />
                      </div>
                    )}
                  </div>
                ),
              };
            })}
          />
        )}
      </div>
    </div>
  );
};

export default V2ThinkingTimeline;
