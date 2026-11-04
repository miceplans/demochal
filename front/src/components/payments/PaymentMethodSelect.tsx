'use client';

import styled from '@emotion/styled';
import { paymentMethodOptions, type PaymentMethod } from '@/lib/payments';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

interface PaymentMethodSelectProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
  /** 노출할 수단. 생략하면 전체. 광고는 예약 유지 시간이 짧아 가상계좌를 뺀다. */
  methods?: ReadonlyArray<PaymentMethod>;
}

export function PaymentMethodSelect({
  value,
  onChange,
  disabled,
  methods,
}: PaymentMethodSelectProps) {
  const options = methods
    ? paymentMethodOptions.filter((option) => methods.includes(option.value))
    : paymentMethodOptions;
  return (
    <Wrap>
      <Legend id="payment-method-label">결제 수단</Legend>
      <Options role="radiogroup" aria-labelledby="payment-method-label">
        {options.map((option) => (
          <Option
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            selected={value === option.value || undefined}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Option>
        ))}
      </Options>
      {value === 'VIRTUAL_ACCOUNT' && (
        <Hint>가상계좌는 발급 후 24시간 안에 입금해야 하고, 입금이 확인되면 신청이 확정돼요.</Hint>
      )}
    </Wrap>
  );
}

const Wrap = styled.div({ display: 'flex', flexDirection: 'column', gap: 12 });
const Legend = styled.span({ ...textStyle.subtitle, color: c.gray900 });
const Options = styled.div({ display: 'flex', flexWrap: 'wrap', gap: 8 });
const Option = styled.button<{ selected?: boolean }>(({ selected }) => ({
  height: 40,
  padding: '0 16px',
  borderRadius: 8,
  border: `0.5px solid ${selected ? c.primary : c.gray300}`,
  background: selected ? c.paleBlue : c.white,
  color: selected ? c.primary : c.gray700,
  cursor: 'pointer',
  ...textStyle.subtitle,
  '&:disabled': { cursor: 'not-allowed', opacity: 0.6 },
  [mobile]: { flex: '1 1 30%' },
}));
const Hint = styled.p({ margin: 0, ...textStyle.bodySmall, color: c.gray500 });
