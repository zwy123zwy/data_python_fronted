import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import 'highlight.js/styles/github.css';
import type { GraphNodeResponse, ResultData } from '../types';

hljs.registerLanguage('sql', sql);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);

export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const markdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  marked.setOptions({ gfm: true, breaks: true });
  const rawHtml = marked.parse(markdown) as string;
  return DOMPurify.sanitize(rawHtml);
};

export const generateResultSetTable = (resultSetData: { columns: string[]; data: Record<string, string>[]; errorMsg?: string }, pageSize: number): string => {
  const columns = resultSetData.columns || [];
  const allData = resultSetData.data || [];
  const total = allData.length;
  const totalPages = Math.ceil(total / pageSize);

  if (resultSetData.errorMsg) {
    return `<div class="result-set-error">错误: ${escapeHtml(resultSetData.errorMsg)}</div>`;
  }
  if (columns.length === 0 || allData.length === 0) {
    return '<div class="result-set-empty">查询结果为空</div>';
  }

  let html = `<div class="result-set-container"><div class="result-set-header"><div class="result-set-info"><span>查询结果 (共 ${total} 条记录)</span><div class="result-set-pagination-controls"><span class="result-set-pagination-info">第 <span class="result-set-current-page">1</span> 页，共 ${totalPages} 页</span><div class="result-set-pagination-buttons"><button class="result-set-pagination-btn result-set-pagination-prev" onclick="window.resultSetPage(this,'prev')" disabled>上一页</button><button class="result-set-pagination-btn result-set-pagination-next" onclick="window.resultSetPage(this,'next')" ${totalPages > 1 ? '' : 'disabled'}>下一页</button></div></div></div></div><div class="result-set-table-container">`;

  for (let page = 1; page <= totalPages; page++) {
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, total);
    const pageData = allData.slice(start, end);
    html += `<div class="result-set-page ${page === 1 ? 'result-set-page-active' : ''}" data-page="${page}"><table class="result-set-table"><thead><tr>`;
    columns.forEach((col) => { html += `<th>${escapeHtml(col)}</th>`; });
    html += '</tr></thead><tbody>';
    pageData.forEach((row) => {
      html += '<tr>';
      columns.forEach((col) => { html += `<td>${escapeHtml(row[col] || '')}</td>`; });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  html += '</div></div>';
  return html;
};

export const formatNodeContent = (nodes: GraphNodeResponse[], showSqlResults: boolean, pageSize: number): string => {
  let content = '';

  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx];

    if (node.textType === 'HTML') {
      content += node.text;
    } else if (node.textType === 'TEXT') {
      content += node.text.replace(/\n/g, '<br>');
    } else if (node.textType === 'JSON' || node.textType === 'PYTHON' || node.textType === 'SQL') {
      let pre = '';
      let p = idx;
      for (; p < nodes.length; p++) {
        if (nodes[p].textType !== node.textType) break;
        pre += nodes[p].text;
      }
      try {
        const language = node.textType.toLowerCase();
        const highlighted = hljs.highlight(pre, { language });
        const codeForBtn = escapeHtml(pre);
        content += `<div class="code-block-wrapper">
          <div class="code-block-header">
            <span class="code-language">${language.toUpperCase()}</span>
            <button class="code-copy-button" onclick="window.copyCodeBlock(this)" data-code="${codeForBtn}">复制</button>
          </div>
          <pre class="hljs"><code class="language-${language}">${highlighted.value}</code></pre>
        </div>`;
      } catch {
        content += `<pre><code>${escapeHtml(pre)}</code></pre>`;
      }
      if (p < nodes.length) idx = p - 1;
      else break;
    } else if (node.textType === 'MARK_DOWN') {
      let markdown = '';
      let p = idx;
      for (; p < nodes.length; p++) {
        if (nodes[p].textType !== 'MARK_DOWN') break;
        markdown += nodes[p].text;
      }
      const safeHtml = markdownToHtml(markdown);
      content += `<div class="markdown-report">${safeHtml}</div>`;
      if (p < nodes.length) idx = p - 1;
      else break;
    } else if (node.textType === 'RESULT_SET') {
      if (!showSqlResults) continue;
      try {
        const resultData: ResultData = JSON.parse(node.text);
        const resultSet = resultData.resultSet;
        if (resultSet && resultData.displayStyle?.type !== 'table' && resultData.displayStyle?.type) {
          continue;
        }
        if (resultSet) {
          content += generateResultSetTable(
            { columns: resultSet.columns || [], data: resultSet.data || [], errorMsg: resultSet.errorMsg },
            pageSize,
          );
        }
      } catch (e) {
        content += `<div class="result-set-error">解析结果集数据失败: ${escapeHtml((e as Error).message)}</div>`;
      }
    } else {
      content += escapeHtml(node.text);
    }
  }

  return content;
};

export const generateNodeHtml = (nodes: GraphNodeResponse[], showSqlResults: boolean, pageSize: number): string => {
  const inner = formatNodeContent(nodes, showSqlResults, pageSize);
  return `<div class="agent-response-block" style="display:block!important;width:100%!important">
    <div class="agent-response-title">${nodes.length > 0 ? escapeHtml(nodes[0].nodeName) : '空节点'}</div>
    <div class="agent-response-content">${inner}</div>
  </div>`;
};
