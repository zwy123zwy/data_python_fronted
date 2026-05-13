import type MarkdownIt from 'markdown-it';

export default function echartsPlugin(md: MarkdownIt) {
  const temp = md.renderer.rules.fence!.bind(md.renderer.rules);
  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    if (token.info === 'echarts') {
      const code = token.content.trim();
      const hasValidJson =
        /\{[\s\S]*\}/.test(code) && code.match(/\{/g)?.length === code.match(/\}/g)?.length;
      if (hasValidJson) {
        try {
          const json = JSON.parse(code);
          return `<div style="width:100%;height:400px" class="md-echarts">${JSON.stringify(json)}</div>`;
        } catch (e) {
          return `<pre>ECharts 配置错误：${(e as Error).message}</pre>`;
        }
      }
      return `<pre><code class="language-echarts md-echarts">${code}</code></pre>`;
    }
    return temp(tokens, idx, options, env, slf);
  };
}
