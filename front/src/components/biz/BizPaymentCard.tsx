'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { paymentCard } from '@/data/biz-design';

const CardVisual = styled.div({
  position: 'relative',
  width: 350,
  height: 224,
  borderRadius: 25,
  background: 'url(/assets/card.png) center / cover no-repeat',
  color: c.white,
  padding: 26,
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
});
const CardBottom = styled.div({
  position: 'absolute',
  left: 26,
  top: 172,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});
const CardNo = styled.strong({
  fontSize: 22,
  fontWeight: 600,
  letterSpacing: '0.08em',
});
const CardMeta = styled.div({
  display: 'flex',
  gap: 20,
  ...textStyle.metaText,
  opacity: 0.7,
});

export function BizPaymentCard({ label, amount }: { label: string; amount: string }) {
  return (
    <CardVisual>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600 }}>{amount}</div>
      <CardBottom>
        <CardNo>{paymentCard.masked}</CardNo>
        <CardMeta>
          <span>카드 명의 {paymentCard.holder}</span>
          <span>유효 기간 {paymentCard.expiry}</span>
        </CardMeta>
      </CardBottom>
    </CardVisual>
  );
}
