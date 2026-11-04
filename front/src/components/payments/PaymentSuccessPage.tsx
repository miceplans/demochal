'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { Button } from '@/components/common/Primitives';
import { adApi } from '@/lib/ad-api';
import { generated } from '@semochal/api-client';
import { colors as c, mobile } from '@/styles/design';

// 서버는 웹훅(Toss 재검증)으로 정산하므로, 성공 리다이렉트 시점에는 주문이 아직 pending일 수 있다.
// 터미널 상태(paid/canceled)가 올 때까지 주문을 폴리한다.
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 30_000;
// 가상계좌 입금 대기 중에는 입금 기한(24시간)까지 느린 주기로 계속 확인한다.
const DEPOSIT_POLL_INTERVAL_MS = 5_000;

type PaymentState = 'checking' | 'paid' | 'failed' | 'timeout' | 'deposit';

interface DepositInfo {
  bankCode: string;
  accountNumber: string;
  dueDate: string;
}

// 토스 은행 코드(금융결제원 공식 코드). 목록에 없는 코드는 코드 그대로 보여준다.
// https://docs.tosspayments.com/codes/org-codes
const BANK_NAMES: Record<string, string> = {
  '002': '한국산업은행',
  '003': 'IBK기업은행',
  '004': 'KB국민은행',
  '007': 'Sh수협은행',
  '011': 'NH농협은행',
  '012': '단위농협(지역농축협)',
  '020': '우리은행',
  '023': 'SC제일은행',
  '027': '씨티은행',
  '030': '수협중앙회',
  '031': 'iM뱅크(대구)',
  '032': '부산은행',
  '034': '광주은행',
  '035': '제주은행',
  '037': '전북은행',
  '039': '경남은행',
  '045': '새마을금고',
  '048': '신협',
  '050': '저축은행중앙회',
  '054': '홍콩상하이은행',
  '060': 'Bank of America',
  '064': '산림조합',
  '071': '우체국예금보험',
  '081': '하나은행',
  '088': '신한은행',
  '089': '케이뱅크',
  '090': '카카오뱅크',
  '092': '토스뱅크',
};

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
const DepositBox = styled.dl({
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  width: 'min(100%, 360px)',
  margin: 0,
  padding: '16px 20px',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
  background: c.white,
  textAlign: 'left',
});
const DepositRow = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  fontSize: 14,
  color: c.gray500,
  strong: { color: c.gray900, fontWeight: 600 },
});
const Actions = styled.div({
  display: 'flex',
  gap: 10,
  marginTop: 12,
  flexWrap: 'wrap',
  justifyContent: 'center',
});
// paid 전환 시 콘텐츠가 페이드업으로 등장하고 확인 배지가 팝한다.
const PaidBlock = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
  animation: 'semo-paid-rise 0.3s ease-out both',
  '@keyframes semo-paid-rise': {
    from: { opacity: 0, transform: 'translateY(8px)' },
    to: { opacity: 1, transform: 'none' },
  },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});
const PaidBadge = styled.span({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 56,
  height: 56,
  borderRadius: '50%',
  background: c.primary,
  animation: 'semo-paid-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
  animationDelay: '0.1s',
  '@keyframes semo-paid-pop': {
    from: { transform: 'scale(0.5)', opacity: 0 },
    to: { transform: 'scale(1)', opacity: 1 },
  },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
  img: { width: 28, height: 28 },
});

export function PaymentSuccessPage() {
  const router = useRouter();
  // 토스 successUrl 쿼리(paymentKey·orderId·amount)는 클라이언트에서만 확정되므로 Suspense 경계 하위에서 읽는다.
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const paymentKey = searchParams.get('paymentKey');
  const isAdFlow = searchParams.get('flow') === 'ad';
  const valid = Boolean(orderId && paymentKey);

  const [state, setState] = useState<PaymentState>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [deposit, setDeposit] = useState<DepositInfo | null>(null);

  useEffect(() => {
    if (!valid || !orderId) return;

    let cancelled = false;
    const controller = new AbortController();
    const startedAt = Date.now();
    let finished = false;
    let waitingDeposit = false;
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
      if (!waitingDeposit && Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        finish('timeout', '결제 확인이 지연되고 있어요. 잠시 후 새로고침해주세요.');
        return;
      }
      try {
        // 한 번에 하나의 조회만 진행되도록 await 뒤에 다음 틱을 예약한다.
        const order = await adApi.orders.get(orderId, { signal: controller.signal });
        if (order.status === 'paid') {
          finish('paid');
        } else if (order.status === 'canceled') {
          finish(
            'failed',
            waitingDeposit
              ? '입금 기한이 지나 주문이 취소됐어요. 다시 신청해주세요.'
              : '결제가 완료되지 않았어요. 다시 시도해주세요.',
          );
        } else {
          // pending이면 다음 폴리 틱까지 계속 대기한다.
          schedule(waitingDeposit ? DEPOSIT_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
        }
      } catch {
        // 조회 취소(언마운트/타임아웃) 외의 개별 실패(일시 네트워크 오류 등)는 타임아웃까지 재시도한다.
        if (!controller.signal.aborted) {
          schedule(waitingDeposit ? DEPOSIT_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
        }
      }
    };

    // 결제 인증 성공 후 서버 승인을 먼저 요청한다 — 토스 결제는 이 승인 없이는
    // 웹훅 없이 종료되지 않는다. 성공하면 결제 저장+주문 확정이 동기 처리되므로
    // 이후 폴링은 확정 상태를 확인만 하고, 실패(네트워크/토스 거절)는 폴링으로 평가한다.
    // 가상계좌는 계좌 발급만 끝난 상태로 돌아오므로 입금 안내를 보여주고, 입금 웹훅으로
    // 주문이 paid가 될 때까지 느린 주기로 폴링해 완료 화면으로 전환한다
    // (새로고침해도 승인 재호출이 같은 계좌 정보를 돌려준다).
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const amount = Number(params.get('amount'));
        if (paymentKey && Number.isFinite(amount) && amount > 0) {
          const response = await generated.confirmPayment({ orderId, paymentKey, amount });
          const account = response.status === 200 ? response.data.virtualAccount : undefined;
          if (account) {
            if (cancelled) return;
            setDeposit(account);
            setState('deposit');
            waitingDeposit = true;
            schedule(DEPOSIT_POLL_INTERVAL_MS);
            return;
          }
        }
      } catch {
        // 승인 호출 실패는 폴링(pending/canceled/timeout)으로 평가한다.
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
        <PaidBlock>
          <PaidBadge aria-hidden="true">
            <img src="/assets/icons/check.svg" alt="" width={28} height={28} />
          </PaidBadge>
          <Title>결제가 완료됐어요</Title>
          <Description>
            {isAdFlow
              ? '광고 계약이 확정됐어요.'
              : '신청이 확정됐어요. 내 신청에서 확인할 수 있어요.'}
          </Description>
          <Actions>
            <Button onClick={() => router.push(isAdFlow ? '/biz/ads' : '/my/applications')}>
              {isAdFlow ? '광고 관리로 이동' : '내 신청 보기'}
            </Button>
          </Actions>
        </PaidBlock>
      )}
      {state === 'deposit' && deposit && (
        <>
          <Title>입금을 기다리고 있어요</Title>
          <Description>
            아래 가상계좌로 입금하면 {isAdFlow ? '광고 계약이' : '신청이'} 확정돼요.
          </Description>
          <DepositBox>
            <DepositRow>
              <span>은행</span>
              <strong>{BANK_NAMES[deposit.bankCode] ?? deposit.bankCode}</strong>
            </DepositRow>
            <DepositRow>
              <span>계좌번호</span>
              <strong>{deposit.accountNumber}</strong>
            </DepositRow>
            <DepositRow>
              <span>입금 기한</span>
              <strong>{new Date(deposit.dueDate).toLocaleString('ko-KR')}</strong>
            </DepositRow>
          </DepositBox>
          <Description>기한 안에 입금하지 않으면 주문이 자동으로 취소돼요.</Description>
          <Actions>
            <Button onClick={() => router.push(isAdFlow ? '/biz/ads' : '/my/applications')}>
              {isAdFlow ? '광고 관리로 이동' : '내 신청 보기'}
            </Button>
          </Actions>
        </>
      )}
      {state === 'failed' && (
        <>
          <Title>결제를 완료하지 못했어요</Title>
          <Description>{message ?? '결제가 완료되지 않았어요.'}</Description>
          <Actions>
            <Button
              onClick={() => router.push(isAdFlow ? '/biz/ads' : '/my/applications')}
              tone="outline"
            >
              {isAdFlow ? '광고 관리로 이동' : '내 신청 보기'}
            </Button>
            <Button onClick={() => router.push(isAdFlow ? '/biz/ads' : '/contests/public-data')}>
              {isAdFlow ? '광고 관리로 이동' : '다시 신청하기'}
            </Button>
          </Actions>
        </>
      )}
      {state === 'timeout' && (
        <>
          <Title>결제 확인이 지연되고 있어요</Title>
          <Description>{message}</Description>
          <Actions>
            <Button onClick={() => window.location.reload()}>새로고침</Button>
            <Button
              onClick={() => router.push(isAdFlow ? '/biz/ads' : '/my/applications')}
              tone="outline"
            >
              {isAdFlow ? '광고 관리로 이동' : '내 신청 보기'}
            </Button>
          </Actions>
        </>
      )}
    </PageWrap>
  );
}
