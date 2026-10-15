'use client';

import { useMemo, useSyncExternalStore } from 'react';
import styled from '@emotion/styled';
import { isRichHtml, sanitizeRichHtml } from '@/lib/rich-text';

/** 공고 상세정보 표시. 서식 HTML이면 정화 후 렌더하고, 과거 평문이면 줄바꿈만 살려 보여준다. */
export function RichDescription({ value }: { value: string }) {
  const rich = isRichHtml(value);
  // DOMPurify는 브라우저 DOM이 필요하므로 서버 렌더에서는 비워 두고 하이드레이션 뒤에 채운다.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const html = useMemo(
    () => (mounted && rich ? sanitizeRichHtml(value) : ''),
    [mounted, rich, value],
  );

  if (!rich) return <Plain>{value}</Plain>;
  return <Rich dangerouslySetInnerHTML={{ __html: html }} />;
}

const noopSubscribe = () => () => {};
const Plain = styled.div({ whiteSpace: 'pre-line', overflowWrap: 'anywhere' });
export const richContentStyles = {
  overflowWrap: 'anywhere',
  lineHeight: 1.6,
  '& p, & div': { margin: '4px 0' },
  '& ul, & ol': { paddingLeft: 24, margin: '8px 0' },
  '& ul': { listStyle: 'disc' },
  '& ol': { listStyle: 'decimal' },
  '& h2': { fontSize: '1.4em', fontWeight: 700, lineHeight: 1.3, margin: '16px 0 6px' },
  '& h3': { fontSize: '1.2em', fontWeight: 700, lineHeight: 1.3, margin: '12px 0 6px' },
  '& small': { fontSize: '0.85em' },
  '& blockquote': { margin: '10px 0', paddingLeft: 12, borderLeft: '3px solid currentColor' },
  '& hr': { margin: '16px 0' },
  '& code': {
    fontFamily: 'monospace',
    padding: '0 4px',
    borderRadius: 4,
    background: 'rgba(0,0,0,0.06)',
  },
  '& a': { textDecoration: 'underline' },
  '& img': { maxWidth: '100%', height: 'auto', display: 'block', margin: '12px 0' },
} as const;
const Rich = styled.div(richContentStyles);
