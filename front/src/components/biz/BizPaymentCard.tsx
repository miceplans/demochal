'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { paymentCard } from '@/data/biz-design';
import { maskCardNumber } from '@/lib/mask';
import { MaskedText } from '@/components/ui/MaskedText';

const CardVisual = styled.div({
  position: 'relative',
  width: 350,
  height: 224,
  borderRadius: 25,
  overflow: 'hidden',
  background:
    'radial-gradient(circle at -37% -16%, rgba(255, 255, 255, 0) 5%, rgba(254, 255, 220, 1) 23%, rgba(0, 111, 255, 1) 37%, rgba(25, 31, 40, 1) 100%)',
  color: c.white,
  flexShrink: 0,
});

const Balance = styled.div({
  position: 'absolute',
  left: 26,
  top: 22.88,
});

const BalanceLabel = styled.div({
  ...textStyle.metaText,
  color: 'rgba(255, 255, 255, 0.7)',
});

const BalanceAmount = styled.div({
  ...textStyle.h1_2,
  marginTop: 3,
});

const Chip = styled.img({
  position: 'absolute',
  left: 291,
  top: 23.83,
  width: 34.77,
  height: 33.14,
  objectFit: 'cover',
});

const CardMeta = styled.div({
  position: 'absolute',
  left: 26,
  top: 90.55,
  display: 'flex',
  gap: 53,
});

const MetaItem = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 2.76,
});

const MetaLabel = styled.span({
  ...textStyle.metaText,
  color: 'rgba(255, 255, 255, 0.7)',
});

const MetaValue = styled.span({
  ...textStyle.h2,
  color: c.white,
});

const CardBottom = styled.div({
  position: 'absolute',
  left: 0,
  top: 157.28,
  width: 350,
  height: 66.72,
  background:
    'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 100%)',
  borderRadius: '0 0 25px 25px',
});

const CardBottomInner = styled.div({
  position: 'absolute',
  left: 26,
  right: 24,
  top: 19.06,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
});

const CardNo = styled.strong({
  ...textStyle.h1_2,
  fontSize: 22,
  lineHeight: 'normal',
  marginTop: 1.91,
});

const CardBrand = styled.img({
  width: 44,
  height: 28.6,
  display: 'block',
});

export function BizPaymentCard({ label, amount }: { label: string; amount: string }) {
  return (
    <CardVisual>
      <Balance>
        <BalanceLabel>{label}</BalanceLabel>
        <BalanceAmount>{amount}</BalanceAmount>
      </Balance>
      <Chip src="/assets/card-chip.png" alt="" />
      <CardMeta>
        <MetaItem>
          <MetaLabel>카드 명의</MetaLabel>
          <MetaValue>{paymentCard.holder}</MetaValue>
        </MetaItem>
        <MetaItem>
          <MetaLabel>유효 기간</MetaLabel>
          <MetaValue>{paymentCard.expiry}</MetaValue>
        </MetaItem>
      </CardMeta>
      <CardBottom>
        <CardBottomInner>
          <CardNo>
            <MaskedText value={paymentCard.number} masked={maskCardNumber(paymentCard.number)} />
          </CardNo>
          <CardBrand src="/assets/card-brand.svg" alt="" />
        </CardBottomInner>
      </CardBottom>
    </CardVisual>
  );
}
