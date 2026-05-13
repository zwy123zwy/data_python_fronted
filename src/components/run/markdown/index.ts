import MarkdownIt from 'markdown-it';
import highlightPlugin from './markdown-plugin-highlight';
import echartsPlugin from './markdown-plugin-echarts';

export { highlightPlugin, echartsPlugin };

/** Create a pre-configured markdown-it instance with highlight + echarts plugins */
export function createMarkdownIt(): MarkdownIt {
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: true,
  });
  md.use(highlightPlugin);
  md.use(echartsPlugin);
  return md;
}
