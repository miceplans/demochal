'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { BizContent, SectionTitle, TableBox, THead, TRow } from '@/components/biz/BizShell';
import { BizPaymentCard } from '@/components/biz/BizPaymentCard';
import { paymentHistory, paymentTotal, won } from '@/data/biz-design';

const Grid = styled.div({ display: 'flex', gap: 32, alignItems: 'flex-start' });
const Col = ({ w, children }: { w?: number; children: React.ReactNode }) => (
  <span style={{ width: w, flexShrink: 0 }}>{children}</span>
);

export function BizBillingPage() {
  return (
    <BizContent>
      <Grid>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, flexShrink: 0 }}>
          <SectionTitle>나의 결제수단</SectionTitle>
          <BizPaymentCard label="총액" amount={`${paymentTotal.toLocaleString()} ₩`} />
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
