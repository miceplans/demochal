'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizContent, SectionTitle, TableBox, THead, TRow } from '@/components/biz/BizShell';
import { paymentCard, paymentHistory, won } from '@/data/biz-design';

const Grid = styled.div({ display: 'flex', gap: 32, alignItems: 'flex-start' });
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
const Col = ({ w, children }: { w?: number; children: React.ReactNode }) => (
  <span style={{ width: w, flexShrink: 0 }}>{children}</span>
);

export function BizBillingPage() {
  return (
    <BizContent>
      <Grid>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, flexShrink: 0 }}>
          <SectionTitle>나의 결제수단</SectionTitle>
          <CardVisual>
            <div style={{ fontSize: 12, opacity: 0.7 }}>금액</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{paymentCard.balance}</div>
            <CardBottom>
              <CardNo>{paymentCard.masked}</CardNo>
              <CardMeta>
                <span>카드 명의 {paymentCard.holder}</span>
                <span>유효 기간 {paymentCard.expiry}</span>
              </CardMeta>
            </CardBottom>
          </CardVisual>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, flex: 1, minWidth: 0 }}>
          <SectionTitle>결제 내역</SectionTitle>
          <TableBox>
            <THead>
              <Col w={300}>결제 항목</Col>
              <Col w={180}>일시</Col>
              <Col w={120}>금액</Col>
            </THead>
            {paymentHistory.map((p) => (
              <TRow key={`${p.name}-${p.date}-${p.amount}`}>
                <Col w={300}>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    }}
                  >
                    {p.name}
                  </span>
                </Col>
                <Col w={180}>
                  <span style={{ fontSize: 13, color: c.gray500 }}>{p.date}</span>
                </Col>
                <Col w={120}>
                  <strong style={{ color: p.amount > 0 ? c.green : c.gray900 }}>
                    {won(p.amount)}
                  </strong>
                </Col>
              </TRow>
            ))}
          </TableBox>
        </div>
      </Grid>
    </BizContent>
  );
}
