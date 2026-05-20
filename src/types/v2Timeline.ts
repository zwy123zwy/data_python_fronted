/** [阶段5] V2 主对话区 — 单条时间线（Gateway / 工具步骤 / 结果摘要） */

export type V2TimelineStatus = 'running' | 'ok' | 'error';

export type V2TimelineKind = 'think' | 'tool' | 'clarify';

export type V2TimelineContentType = 'text' | 'sql' | 'result_set' | 'markdown';

export interface V2TimelineEntry {
  id: string;
  kind: V2TimelineKind;
  title: string;
  /** 折叠时可见的一行摘要 */
  detail?: string;
  /** 展开后的完整正文 */
  content?: string;
  contentType?: V2TimelineContentType;
  status: V2TimelineStatus;
  toolName?: string;
  agentName?: string;
}
