'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { Button } from '@/components/common/Primitives';
import { colors as c } from '@/styles/design';

const PageWrap = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '40px 0',
});
const Title = styled.h1({
  color: c.gray900,
  fontSize: 24,
  fontWeight: 600,
});
const Description = styled.p({
  color: c.gray500,
  fontSize: 15,
  lineHeight: 1.6,
  margin: 0,
});
const Actions = styled.div({ display: 'flex', gap: 10, marginTop: 8 });

export function BillingAuthFailPage() {
  const router = useRouter();
  // 토스 빌링 인증 실패 리다이렉트 쿼리 — 클라이언트에서만 확정되므로 Suspense 경계 하위에서 읽는다.
  const message = useSearchParams().get('message');

  return (
    <PageWrap>
      <Title>카드 등록을 완료하지 못했어요</Title>
      <Description>{message ?? '등록이 취소됐거나 중단됐어요. 다시 시도해주세요.'}</Description>
      <Actions>
        <Button onClick={() => router.push('/biz/billing')}>다시 시도하기</Button>
      </Actions>
    </PageWrap>
  );
}
