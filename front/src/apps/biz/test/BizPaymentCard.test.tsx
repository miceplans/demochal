import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BizPaymentCard } from '../components/BizPaymentCard';

describe('BizPaymentCard', () => {
  afterEach(cleanup);

  it('renders the masked card number as plain text', () => {
    const { container } = render(
      <BizPaymentCard
        label="금액"
        amount="12,000 ₩"
        maskedNumber="****-****-****-1234"
        cardName="국민카드"
      />,
    );

    expect(screen.getByText('****-****-****-1234')).not.toBeNull();
    expect(screen.getByText('국민카드')).not.toBeNull();
    // 원본을 복원할 수 없으므로 "호버 시 전체 확인" 툴팁 약속이 남아있지 않아야 한다.
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('omits the card meta row when cardName is not provided', () => {
    render(<BizPaymentCard label="금액" amount="0 ₩" maskedNumber="****-****-****-1234" />);

    expect(screen.getByText('****-****-****-1234')).not.toBeNull();
    expect(screen.queryByText('국민카드')).toBeNull();
  });
});
