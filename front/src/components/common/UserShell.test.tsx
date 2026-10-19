import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Content, FormContent } from './UserShell';

function emotionCss() {
  return Array.from(document.querySelectorAll('style[data-emotion]'))
    .map((node) => node.textContent ?? '')
    .join('\n');
}

describe('Content size variants', () => {
  afterEach(cleanup);

  it('renders the default 1200px container when size is omitted', () => {
    render(<Content>본문</Content>);
    expect(emotionCss()).toContain('min(1200px, calc(100% - 48px))');
  });

  it('renders the medium 720px container for the medium size', () => {
    render(<Content size="medium">본문</Content>);
    expect(emotionCss()).toContain('min(720px, calc(100% - 48px))');
  });

  it('renders the narrow 640px container for the narrow size', () => {
    render(<Content size="narrow">본문</Content>);
    expect(emotionCss()).toContain('min(640px, calc(100% - 48px))');
  });

  it('keeps the shared mobile gutter for every size', () => {
    render(<Content size="narrow">본문</Content>);
    const css = emotionCss();
    expect(css).toContain('@media (max-width: 480px)');
    expect(css).toContain('width:100%');
    expect(css).toContain('padding:24px 16px');
  });
});

describe('FormContent', () => {
  afterEach(cleanup);

  it('renders a form element with the shared container rules', () => {
    const { container } = render(<FormContent size="narrow">폼</FormContent>);
    expect(container.querySelector('form')).toBeTruthy();
    const css = emotionCss();
    expect(css).toContain('min(640px, calc(100% - 48px))');
    expect(css).toContain('padding:24px 16px');
  });
});
