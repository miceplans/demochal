'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { Button } from '@/components/common/Primitives';
import { adApi } from '@/lib/ad-api';
import { colors as c, mobile } from '@/styles/design';

// 서버는 웹훅(Toss 재검증)으로 정산하므로, 성공 리다이렉트 시점에는 주문이 아직 pending일 수 있다.
// 터미널 상태(paid/canceled)가 올 때까지 주문을 폴리한다.
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 30_000;

type PaymentState = 'checking' | 'paid' | 'failed' | 'timeout';

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
});
const Actions = styled.div({
  display: 'flex',
  gap: 10,
  marginTop: 12,
  flexWrap: 'wrap',
  justifyContent: 'center',
});

export function PaymentSuccessPage() {
  const router = useRouter();
  // 토스 successUrl 쿼리(paymentKey·orderId·amount)는 클라이언트에서만 확정되므로 Suspense 경계 하위에서 읽는다.
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const paymentKey = searchParams.get('paymentKey');
  const valid = Boolean(orderId && paymentKey);

  const [state, setState] = useState<PaymentState>('checking');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!valid || !orderId) return;

    let cancelled = false;
    const controller = new AbortController();
    const startedAt = Date.now();
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (next: PaymentState, nextMessage?: string) => {
      // 터미널 상태는 한 번만 적용한다 — 늦게 도착하는 진행 중 응답이
      // 타임아웃/다른 터미널 상태를 덮어쓰지 않게.
      if (cancelled || finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      setState(next);
      if (nextMessage) setMessage(nextMessage);
    };

    const schedule = (delay: number) => {
      if (cancelled || finished) return;
      timer = setTimeout(() => {
        void poll();
      }, delay);
    };

    const poll = async () => {
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        finish('timeout', '결제 확인이 지연되고 있어요. 잠시 후 새로고침해주세요.');
        return;
      }
      try {
        // 한 번에 하나의 조회만 진행되도록 await 뒤에 다음 틱을 예약한다.
        const order = await adApi.orders.get(orderId, { signal: controller.signal });
        if (order.status === 'paid') {
          finish('paid');
        } else if (order.status === 'canceled') {
          finish('failed', '결제가 완료되지 않았어요. 다시 시도해주세요.');
        } else {
          // pending이면 다음 폴리 틱까지 계속 대기한다.
          schedule(POLL_INTERVAL_MS);
        }
      } catch {
        // 조회 취소(언마운트/타임아웃) 외의 개별 실패(일시 네트워크 오류 등)는 타임아웃까지 재시도한다.
        if (!controller.signal.aborted) schedule(POLL_INTERVAL_MS);
      }
    };

    // 카드 인증 성공 후 서버 승인을 먼저 요청한다 — 토스 카드 결제는 이 승인 없이는
    // 웹훅 없이 종료되지 않는다. 성공하면 결제 저장+주문 확정이 동기 처리되므로
    // 이후 폴리는 확정 상태를 확인만 하고, 실패(네트워크/토스 거절)는 폴리로 평가한다.
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const amount = Number(params.get('amount'));
        if (paymentKey && Number.isFinite(amount) && amount > 0) {
          await adApi.payments.confirm({ orderId, paymentKey, amount });
        }
      } catch {
        // 승인 호출 실패는 폴리(pending/canceled/timeout)로 평가한다.
      }
      poll();
    })();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [valid, orderId, paymentKey]);

  if (!valid) {
    return (
      <PageWrap>
        <Title>결제를 완료하지 못했어요</Title>
        <Description>결제 정보가 올바르지 않아요. 다시 신청해주세요.</Description>
        <Actions>
          <Button onClick={() => router.push('/contests/public-data')}>다시 신청하기</Button>
        </Actions>
      </PageWrap>
    );
  }

  return (
    <PageWrap>
      {state === 'checking' && (
        <>
          <Title>결제 확인 중이에요</Title>
          <Description>결제 내역을 확인하고 있어요. 잠시만 기다려주세요.</Description>
        </>
      )}
      {state === 'paid' && (
        <>
          <Title>결제가 완료됐어요</Title>
          <Description>신청이 확정됐어요. 내 신청에서 확인할 수 있어요.</Description>
          <Actions>
            <Button onClick={() => router.push('/my/applications')}>내 신청 보기</Button>
          </Actions>
        </>
      )}
      {state === 'failed' && (
        <>
          <Title>결제를 완료하지 못했어요</Title>
          <Description>{message ?? '결제가 완료되지 않았어요.'}</Description>
          <Actions>
            <Button onClick={() => router.push('/my/applications')} tone="outline">
              내 신청 보기
            </Button>
            <Button onClick={() => router.push('/contests/public-data')}>다시 신청하기</Button>
          </Actions>
        </>
      )}
      {state === 'timeout' && (
        <>
          <Title>결제 확인이 지연되고 있어요</Title>
          <Description>{message}</Description>
          <Actions>
            <Button onClick={() => window.location.reload()}>새로고침</Button>
            <Button onClick={() => router.push('/my/applications')} tone="outline">
              내 신청 보기
            </Button>
          </Actions>
        </>
      )}
    </PageWrap>
  );
}
