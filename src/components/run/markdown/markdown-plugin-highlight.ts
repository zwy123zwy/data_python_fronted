import 'highlight.js/styles/atom-one-light.css';
import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import type MarkdownIt from 'markdown-it';

hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('python', python);

// Install global copyCodeBlock for code copy buttons
if (typeof window !== 'undefined' && !window.copyCodeBlock) {
  window.copyCodeBlock = (btn: HTMLElement) => {
    const code = btn.getAttribute('data-code');
    if (!code) return;
    const originalText = btn.textContent;
    const parser = new DOMParser();
    const decodedCode = parser.parseFromString(`<div>${code}</div>`, 'text/html').querySelector('div')?.textContent;
    if (!decodedCode) return;
    navigator.clipboard.writeText(decodedCode).then(() => {
      btn.textContent = '已复制！';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = originalText; btn.classList.remove('copied'); }, 2000);
    }).catch(() => {
      btn.textContent = '复制失败';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    });
  };
}

export default function highlightPlugin(md: MarkdownIt) {
  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const code = token.content;
    const lang = token.info;
    const langObj = hljs.getLanguage(lang);
    const cnt = langObj ? hljs.highlight(lang, code).value : hljs.highlightAuto(code).value;

    const escapeHtml = (text: string) =>
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

    const safeLang = (typeof lang === 'string' ? lang : '').toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    const langClass = safeLang || 'plaintext';
    const langLabel = lang ? lang.toUpperCase() : '文本';

    return `<div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-language">${escapeHtml(langLabel)}</span>
        <button class="code-copy-button" onclick="copyCodeBlock(this)" data-code="${escapeHtml(code)}">复制</button>
      </div>
      <pre class="hljs"><code class="language-${langClass}">${cnt}</code></pre>
    </div>`;
  };
}
