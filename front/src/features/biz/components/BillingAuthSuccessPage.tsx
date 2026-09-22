'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
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

export function BillingAuthSuccessPage() {
  const router = useRouter();
  // 토스 빌링 인증 성공 리다이렉트 쿼리 — 클라이언트에서만 확정되므로 Suspense 경계 하위에서 읽는다.
  const authKey = useSearchParams().get('authKey');
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!authKey) return;
    let cancelled = false;
    generated
      .issueBillingAuthorization({ authKey })
      .then(() => {
        if (cancelled) return;
        setDone(true);
        router.replace('/biz/billing');
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authKey, router]);

  if (!authKey || failed) {
    return (
      <PageWrap>
        <Title>카드 등록을 완료하지 못했어요</Title>
        <Description>인증 정보가 올바르지 않거나 처리에 실패했어요. 다시 시도해주세요.</Description>
        <Actions>
          <Button onClick={() => router.push('/biz/billing')}>결제수단 관리로</Button>
        </Actions>
      </PageWrap>
    );
  }

  if (done) {
    return (
      <PageWrap>
        <Title>카드 등록이 완료됐어요</Title>
        <Description>결제수단 관리로 이동하고 있어요.</Description>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      <Title>카드를 등록하고 있어요</Title>
      <Description>등록 정보를 확인하고 있어요. 잠시만 기다려주세요.</Description>
    </PageWrap>
  );
}
