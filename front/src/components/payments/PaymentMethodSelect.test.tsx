import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@emotion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { theme } from '@/styles/theme';
import { PaymentMethodSelect } from './PaymentMethodSelect';

const renderSelect = (
  value: Parameters<typeof PaymentMethodSelect>[0]['value'],
  onChange = vi.fn(),
) =>
  render(
    <ThemeProvider theme={theme}>
      <PaymentMethodSelect value={value} onChange={onChange} />
    </ThemeProvider>,
  );

describe('PaymentMethodSelect', () => {
  afterEach(cleanup);

  it('lists card, easy-pay and virtual account methods with the current one checked', () => {
    renderSelect('KAKAOPAY');
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual([
      '카드',
      '토스페이',
      '카카오페이',
      '네이버페이',
      '가상계좌',
    ]);
    expect(screen.getByRole('radio', { name: '카카오페이' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('reports the chosen method and explains the deposit window for virtual accounts', () => {
    const onChange = vi.fn();
    const { rerender } = renderSelect('CARD', onChange);
    expect(screen.queryByText(/24시간 안에 입금/)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: '가상계좌' }));
    expect(onChange).toHaveBeenCalledWith('VIRTUAL_ACCOUNT');

    rerender(
      <ThemeProvider theme={theme}>
        <PaymentMethodSelect value="VIRTUAL_ACCOUNT" onChange={onChange} />
      </ThemeProvider>,
    );
    expect(screen.getByText(/24시간 안에 입금/)).toBeTruthy();
  });

  it('hides methods that are not offered (ads exclude virtual accounts)', () => {
    render(
      <ThemeProvider theme={theme}>
        <PaymentMethodSelect value="CARD" onChange={vi.fn()} methods={['CARD', 'TOSSPAY']} />
      </ThemeProvider>,
    );
    expect(screen.getAllByRole('radio').map((r) => r.textContent)).toEqual(['카드', '토스페이']);
  });
});
