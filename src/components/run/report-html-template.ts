/**
 * Build a self-contained HTML report from markdown content.
 * Embeds CDN dependencies (marked.js, ECharts) for offline viewing.
 */
export function buildReportHtml(markdownContent: string, title = '数据分析报告'): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
      max-width: 960px; margin: 0 auto; padding: 24px 16px;
      color: #333; line-height: 1.6; background: #fff;
    }
    h1 { font-size: 28px; margin: 24px 0 16px; border-bottom: 2px solid #1677ff; padding-bottom: 8px; }
    h2 { font-size: 22px; margin: 20px 0 12px; }
    h3 { font-size: 18px; margin: 16px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #dee2e6; padding: 8px 12px; text-align: left; }
    th { background: #f8f9fa; font-weight: 600; }
    pre { background: #f8f9fa; padding: 12px; border-radius: 4px; overflow-x: auto; }
    code { background: #f8f9fa; padding: 2px 4px; border-radius: 3px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; }
    .md-echarts { margin: 16px 0; }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1a; color: #e0e0e0; }
      th { background: #2d2d2d; }
      pre, code { background: #2d2d2d; color: #e0e0e0; }
      th, td { border-color: #404040; }
    }
  </style>
</head>
<body>
  <div id="content"></div>
  <script>
    // Render markdown
    var markdown = ${JSON.stringify(markdownContent)};
    var html = marked.parse(markdown);
    document.getElementById('content').innerHTML = html;

    // Initialize ECharts from md-echarts divs
    document.querySelectorAll('.md-echarts').forEach(function(el) {
      try {
        var option = JSON.parse(el.textContent || '{}');
        var chart = echarts.init(el);
        chart.setOption(option);
        window.addEventListener('resize', function() { chart.resize(); });
      } catch(e) { console.error('ECharts init error:', e); }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
