'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styled from '@emotion/styled';
import { UserShell } from '@/components/common/UserShell';
import { Button } from '@/components/common/Primitives';
import { useUserStore } from '@/stores/useUserStore';
import { useToast } from '@/components/common/Toast';
import { adApi } from '@/lib/ad-api';
import { apiErrorMessage } from '@/lib/api-error';
import { requestTossPayment } from '@/lib/payments';
import { generated } from '@semochal/api-client';
import { colors as c, mobile } from '@/styles/design';
import { ApplicationQuestions, isAnswerValid, type Answers } from './ApplicationQuestions';

const Form = styled.form({
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
  width: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  padding: '60px 120px',
  minHeight: 724,
  '@media (max-width: 900px)': { padding: '48px clamp(32px, 8vw, 80px)' },
  [mobile]: { minHeight: 'calc(100dvh - 44px)', gap: 28, padding: '20px 16px 32px' },
});
const FormTitle = styled.h1({
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  color: c.gray900,
  fontSize: 40,
  fontWeight: 600,
  minWidth: 0,
  lineHeight: 1.3,
  letterSpacing: '-0.02em',
  '@media (max-width: 900px)': { fontSize: 32 },
  [mobile]: { gap: 8, fontSize: 20, letterSpacing: 0 },
});
const Content = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
  [mobile]: { gap: 28 },
});
const Actions = styled.div({
  display: 'flex',
  width: 298,
  maxWidth: '100%',
  alignSelf: 'flex-end',
  gap: 20,
  [mobile]: { width: '100%', alignSelf: 'stretch', gap: 10, marginTop: 'auto' },
});
const ActionButton = styled(Button)({
  flex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  minHeight: 37,
  padding: '10px 12px',
  borderRadius: 6,
  fontSize: 12,
  [mobile]: { minHeight: 52, borderRadius: 12, fontSize: 15 },
});
// 제출/업로드 중임을 텍스트 교체만이 아니라 스피너로도 보여준다.
const Spinner = styled.span({
  width: 13,
  height: 13,
  flexShrink: 0,
  borderRadius: '50%',
  border: `2px solid ${c.gray50}`,
  borderTopColor: c.white,
  animation: 'semo-spin 0.7s linear infinite',
  '@keyframes semo-spin': { to: { transform: 'rotate(360deg)' } },
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
});
export function ApplicationPage() {
  // useSearchParams는 Suspense 경계가 필요해(정적 프리렌더) 폼을 안쪽 컴포넌트로 감싼다.
  return (
    <Suspense fallback={null}>
      <ApplicationFormRoute />
    </Suspense>
  );
}

function ApplicationFormRoute() {
  const challengeId = useSearchParams().get('challenge');
  return <ApplicationForm key={challengeId ?? 'generic'} challengeId={challengeId} />;
}

function ApplicationForm({ challengeId }: { challengeId: string | null }) {
  const draft = useUserStore((s) => s.applicationDraft);
  const save = useUserStore((s) => s.saveApplication);
  const toast = useToast();
  const router = useRouter();
  // /applications/new?challenge=<uuid> — 챌린지 상세의 "참가 신청하기" 링크로만 들어온다.
  const challengeQuery = generated.useGetChallenge(challengeId ?? '', {
    query: { enabled: Boolean(challengeId) },
  });
  const challenge = challengeQuery.data?.status === 200 ? challengeQuery.data.data : undefined;
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [answers, setAnswers] = useState<Answers>(
    draft?.challengeId === challengeId ? (draft.answers ?? {}) : {},
  );
  const questions = challenge?.applicationForm ?? [];
  const saveDraft = () => {
    save({ challengeId: challengeId ?? undefined, answers });
    toast.success('임시저장했어요');
  };

  // /applications/new?challenge=<uuid> 진입 시에만 실제 신청·결제 흐름으로 동작한다(챌린지 상세 등에서 링크).
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || uploading) return;
    if (challengeId && (!challenge || challengeQuery.isError)) {
      toast.error('공고 정보를 불러온 뒤 다시 제출해 주세요.');
      return;
    }
    const invalid = questions.find((question) => !isAnswerValid(question, answers[question.id]));
    if (invalid) {
      toast.error(`“${invalid.title}” 답변을 확인해 주세요.`);
      return;
    }
    save({ challengeId: challengeId ?? undefined, answers });
    if (!challengeId) {
      // 목업 카탈로그 화면에서는 진입 링크에 챌린지 UUID가 없다 — 이 경우 저장만 하고
      // 실제 신청·결제 흐름은 챌린지 신청 링크(/applications/new?challenge=<uuid>) 경로로만
      // 진행된다는 것을 명시한다(신청 완료처럼 보이면 안 된다).
      toast.error(
        '이 화면에서는 임시저장만 돼요',
        '실제 신청은 챌린지의 참가 신청하기를 이용해주세요',
      );
      return;
    }
    setSubmitting(true);
    // 결제창 진입 실패·예외 시 서버에 만든 pending 주문을 정리해 미결제 주문이 남지 않게 한다.
    let pendingOrderId: string | null = null;
    const cancelPendingOrder = async () => {
      if (!pendingOrderId) return;
      const orderId = pendingOrderId;
      pendingOrderId = null;
      await adApi.orders.cancel(orderId).catch(() => {});
    };
    try {
      const response = await generated.applyChallenge({
        challengeId,
        formAnswers: questions
          .filter((question) => answers[question.id] !== undefined)
          .map((question) => ({ questionId: question.id, value: answers[question.id]! })),
      });
      if (response.status !== 201) throw new Error('Application rejected');
      const result = response.data;
      // 무료 챌린지(price 0)는 결제 없이 완료. 유료는 서버가 만든 pending 주문으로 토스 결제창을 연다.
      if (!result.order) {
        toast.success('신청이 완료됐어요');
        router.push('/my/applications');
        return;
      }
      pendingOrderId = result.order.id;
      const started = await requestTossPayment({
        orderId: result.order.id,
        amount: result.order.amount,
        orderName: result.order.name,
      });
      if (!started) {
        await cancelPendingOrder();
        toast.error('결제를 시작할 수 없어요', 'NEXT_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았어요');
      }
    } catch (error) {
      await cancelPendingOrder();
      toast.error('신청에 실패했어요', apiErrorMessage(error, '잠시 후 다시 시도해주세요'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <UserShell title="지원서 작성" back="/contests/public-data" footer={false}>
      <Form onSubmit={handleSubmit}>
        <Content>
          <FormTitle>{challenge?.title ? `${challenge.title} 신청서` : '챌린지 신청서'}</FormTitle>
          <ApplicationQuestions
            questions={questions}
            answers={answers}
            onChange={(id, value) => setAnswers((current) => ({ ...current, [id]: value }))}
            onUploading={setUploading}
            disabled={submitting || uploading}
          />
          {challengeId && challengeQuery.isError && (
            <p role="alert">
              공고 정보를 불러오지 못했습니다.{' '}
              <button type="button" onClick={() => void challengeQuery.refetch()}>
                다시 시도
              </button>
            </p>
          )}
        </Content>
        <Actions>
          <ActionButton type="button" tone="plain" onClick={saveDraft}>
            임시저장
          </ActionButton>
          <ActionButton
            type="submit"
            disabled={submitting || uploading || Boolean(challengeId && !challenge)}
          >
            {submitting || uploading ? (
              <Spinner aria-hidden="true" data-component="submit-spinner" />
            ) : null}
            {uploading ? '첨부파일 업로드 중…' : submitting ? '처리 중…' : '제출'}
          </ActionButton>
        </Actions>
      </Form>
    </UserShell>
  );
}
