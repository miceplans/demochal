'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { BizContent, useBizHref } from '@/components/biz/BizShell';
import { useToast } from '@/components/common/Toast';
import { adApi, adError } from '@/lib/ad-api';
import { colors as c } from '@/styles/design';
import { EMPTY_POSTING, toDateInput, toDateTimeInput } from './BizPostingFormPage.logic';
import { PostingForm } from './PostingForm';

export { normalizeFontTags } from './BizPostingFormPage.logic';

export function BizPostingFormPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  const [businessId, setBusinessId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const createChallenge = generated.useCreateChallenge();

  useEffect(() => {
    let active = true;
    adApi.businesses
      .me()
      .then((business) => active && setBusinessId(business.id))
      .catch((cause) => active && setLoadError(adError(cause)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <PostingForm
      initial={EMPTY_POSTING}
      submitLabel="게시하기"
      submittingLabel="게시 중…"
      disabled={loading || !businessId}
      initialError={loadError}
      onSubmit={async (values) => {
        // 생성 스펙은 null을 받지 않으므로(nullable이 아닌 선택 필드), 수정용 폼 값의 null은 생략으로 바꿔 본다.
        const response = await createChallenge.mutateAsync({
          data: {
            businessId,
            ...values,
            category: values.category ?? undefined,
            eventStartDate: values.eventStartDate ?? undefined,
            eventEndDate: values.eventEndDate ?? undefined,
            supervisor: values.supervisor ?? undefined,
            sponsor: values.sponsor ?? undefined,
            supporter: values.supporter ?? undefined,
            targetOther: values.targetOther ?? undefined,
            targets: values.targets ?? undefined,
            organizerType: values.organizerType ?? undefined,
            prizeAmount: values.prizeAmount ?? undefined,
            posterFileId: values.posterFileId ?? undefined,
            thumbnailFileId: values.thumbnailFileId ?? undefined,
            summary: values.summary ?? undefined,
            hashtags: values.hashtags ?? undefined,
            topics: values.topics ?? undefined,
            inquiryContact: values.inquiryContact ?? undefined,
            visibility: values.visibility,
          },
        });
        router.push(hrefOf(`/postings/${response.data.id}`));
      }}
      showRecruitMethod
    />
  );
}

export function BizPostingEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hrefOf = useBizHref();
  const toast = useToast();
  const queryClient = useQueryClient();
  const challengeQuery = generated.useGetMyChallenge(id, { query: { enabled: Boolean(id) } });
  const updateChallenge = generated.useUpdateChallenge();
  const challenge = challengeQuery.data?.status === 200 ? challengeQuery.data.data : undefined;

  if (challengeQuery.isPending)
    return (
      <BizContent>
        <Message>공고 정보를 불러오는 중입니다.</Message>
      </BizContent>
    );
  if (!challenge)
    return (
      <BizContent>
        <Message>
          공고를 불러오지 못했습니다.{' '}
          <button type="button" onClick={() => void challengeQuery.refetch()}>
            다시 시도
          </button>
        </Message>
      </BizContent>
    );

  return (
    <PostingForm
      initial={{
        title: challenge.title ?? '',
        description: challenge.description ?? '',
        price: challenge.price ?? 0,
        startDate: toDateTimeInput(challenge.startDate),
        endDate: toDateTimeInput(challenge.endDate),
        eventStartDate: toDateInput(challenge.eventStartDate ?? undefined),
        eventEndDate: toDateInput(challenge.eventEndDate ?? undefined),
        host: challenge.host ?? '',
        supervisor: challenge.supervisor ?? '',
        sponsor: challenge.sponsor ?? '',
        supporter: challenge.supporter ?? '',
        targetOther: challenge.targetOther ?? '',
        attachments: challenge.attachments ?? [],
        category: challenge.category ?? '',
        posterUrl: challenge.posterUrl ?? null,
        targets: challenge.targets ?? [],
        organizerType: challenge.organizerType ?? null,
        prizeAmount:
          challenge.prizeAmount === undefined || challenge.prizeAmount === null
            ? ''
            : String(challenge.prizeAmount),
        recruitMethod: challenge.recruitMethod,
        recruitUrl: challenge.recruitUrl ?? '',
        summary: challenge.summary ?? '',
        hashtags: (challenge.hashtags ?? []).join(', '),
        topics: challenge.topics ?? [],
        inquiryContact: challenge.inquiryContact ?? '',
        visibility: challenge.visibility === 'private' ? 'private' : 'public',
      }}
      submitLabel="수정 저장"
      submittingLabel="저장 중…"
      onSubmit={async (values) => {
        await updateChallenge.mutateAsync({ id, data: values });
        await queryClient.invalidateQueries({ queryKey: generated.getGetMyChallengeQueryKey(id) });
        toast.success('공고를 수정했습니다');
        router.push(hrefOf(`/postings/${id}`));
      }}
    />
  );
}

const Message = styled.p({ color: c.gray700, margin: 0 });
