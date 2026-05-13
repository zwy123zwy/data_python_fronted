import React, { useMemo, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

interface Props {
  content: string;
}

const ReportHtmlView: React.FC<Props> = ({ content }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sanitized = useMemo(() => DOMPurify.sanitize(content, {
    ADD_TAGS: ['iframe', 'script'],
    ADD_ATTR: ['frameborder', 'allowfullscreen', 'scrolling'],
  }), [content]);

  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentDocument) {
      const doc = iframeRef.current.contentDocument;
      doc.open();
      doc.write(sanitized);
      doc.close();
    }
  }, [sanitized]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts allow-same-origin"
      style={{ width: '100%', minHeight: 400, border: '1px solid #e9ecef', borderRadius: 6 }}
      title="报告预览"
    />
  );
};

export default ReportHtmlView;
