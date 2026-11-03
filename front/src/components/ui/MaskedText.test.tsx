import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { afterEach, describe, expect, it } from 'vitest';
import { theme } from '@/styles/theme';
import { MaskedText } from './MaskedText';

function renderMasked(props: React.ComponentProps<typeof MaskedText>) {
  return render(
    <ThemeProvider theme={theme}>
      <MaskedText {...props} />
    </ThemeProvider>,
  );
}

describe('MaskedText', () => {
  afterEach(cleanup);

  it('renders the given masked text and keeps the original in the reveal node', () => {
    renderMasked({ value: '110-81-12345', masked: '110-**-*****' });

    expect(screen.getByText('110-**-*****')).not.toBeNull();
    expect(screen.getByText('110-81-12345')).not.toBeNull();
    // unveilmask 구조: .nm 안에 .nm-masked(표시)와 .nm-real(호버/포커스 노출)이 같이 있다.
    expect(document.querySelector('.nm')).not.toBeNull();
    expect(document.querySelector('.nm .nm-masked')?.textContent).toBe('110-**-*****');
    expect(document.querySelector('.nm .nm-real')?.textContent).toBe('110-81-12345');
  });

  it('masks the value with unveilmask when no masked display is given', () => {
    renderMasked({ value: 'hello@example.com' });

    expect(document.querySelector('.nm .nm-masked')?.textContent).toBe('he*lo@example.com');
    expect(document.querySelector('.nm .nm-real')?.textContent).toBe('hello@example.com');
  });
});
