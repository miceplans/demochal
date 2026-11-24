'use client';

import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';

// 광고는 온라인 결제 대신 전화 상담 → 계좌 입금 → 관리자 직접 등록(POST /admin/ads)으로 게재한다.
const PHONE = '051-783-1170';
const ACCOUNT = { bank: 'KB국민은행', number: '564701-01-619555' };

export function AdInquiryPage() {
  return (
    <Page>
      <Title>광고 문의</Title>
      <Lead>세모챌 홈 배너·갤러리 광고는 전화 상담 후 계좌 입금으로 진행돼요.</Lead>

      <Card>
        <Label>문의 전화</Label>
        <PhoneLink href={`tel:${PHONE.replace(/-/g, '')}`}>{PHONE}</PhoneLink>
        <Meta>평일 업무시간 · mice@miceplans.com</Meta>
      </Card>

      <Card>
        <Label>입금 계좌</Label>
        <Value>
          {ACCOUNT.bank} {ACCOUNT.number}
        </Value>
      </Card>

      <Steps>
        <li>전화로 광고 위치와 기간을 상담해요.</li>
        <li>안내받은 광고비를 위 계좌로 입금해요.</li>
        <li>입금이 확인되면 담당자가 광고를 등록해 게재해요.</li>
      </Steps>
    </Page>
  );
}

const Page = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  width: '100%',
  maxWidth: 560,
  margin: '0 auto',
  padding: '48px 0',
  [mobile]: { padding: '24px 0' },
});
const Title = styled.h1({ margin: 0, ...textStyle.display, color: c.gray900 });
const Lead = styled.p({ margin: 0, ...textStyle.body, color: c.gray500 });
const Card = styled.section({
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: 20,
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  background: c.white,
});
const Label = styled.span({ ...textStyle.subtitle, color: c.gray700 });
const valueStyle = {
  ...textStyle.display,
  color: c.primary,
  textDecoration: 'none',
  wordBreak: 'keep-all',
} as const;
const Value = styled.strong(valueStyle);
const PhoneLink = styled.a(valueStyle);
const Meta = styled.span({ ...textStyle.metaText, color: c.gray500 });
const Steps = styled.ol({
  margin: 0,
  paddingLeft: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  ...textStyle.bodySmall,
  color: c.gray700,
});
