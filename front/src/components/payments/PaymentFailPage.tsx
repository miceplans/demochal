'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { Button } from '@/components/common/Primitives';
import { colors as c, mobile } from '@/styles/design';

const PageWrap = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  minHeight: 'calc(100dvh - 44px)',
  padding: '40px 20px',
  boxSizing: 'border-box',
  textAlign: 'center',
});
const Title = styled.h1({
  color: c.gray900,
  fontSize: 28,
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: '-0.02em',
  [mobile]: { fontSize: 22 },
});
const Description = styled.p({
  color: c.gray500,
  fontSize: 15,
  lineHeight: 1.6,
  margin: 0,
  wordBreak: 'keep-all',
});
const Actions = styled.div({
  display: 'flex',
  gap: 10,
  marginTop: 12,
  flexWrap: 'wrap',
  justifyContent: 'center',
});

export function PaymentFailPage() {
  const router = useRouter();
  // 토스 failUrl 쿼리(message·code·orderId)는 클라이언트에서만 확정되므로 Suspense 경계 하위에서 읽는다.
  const message = useSearchParams().get('message');

  return (
    <PageWrap>
      <Title>결제를 완료하지 못했어요</Title>
      <Description>{message ?? '결제가 취소됐거나 중단됐어요. 다시 시도해주세요.'}</Description>
      <Actions>
        <Button onClick={() => router.push('/contests/public-data')}>다시 신청하기</Button>
        <Button onClick={() => router.push('/')} tone="outline">
          홈으로
        </Button>
      </Actions>
    </PageWrap>
  );
}
