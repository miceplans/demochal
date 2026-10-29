'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { Icon } from '@/components/common/Primitives';
import { LoadingState } from '@/components/common/LoadingState';
import { BizContent, OutlineButton, PrimaryButton, useBizHref } from '@/components/biz/BizShell';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';
import { siteHref } from '@/lib/biz';
import { challengeEligibility } from '@/lib/challenge';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { ApplicationResponsePanel } from './ApplicationResponsePanel';
import {
  ApplicationTable,
  GhostButton,
  EVALUATION_LABEL,
  type ApplicationPatch,
} from './ApplicationTable';

const FILTER_OPTIONS: DropdownOption[] = [
  { value: '', label: '전체' },
  ...(['undecided', 'pass', 'fail'] as const).map((value) => ({
    value,
    label: EVALUATION_LABEL[value],
  })),
];
const formatDate = (iso: string) => iso.slice(0, 10).replaceAll('-', '.');

/** 신청자 응답 > 행사 상세 — 행사 프리뷰·신청서 편집 버튼과 이 행사의 신청서 뷰(표 + 응답 사이드 패널). */
export function BizApplicationsEventPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hrefOf = useBizHref();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [evaluation, setEvaluation] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const challengeQuery = generated.useGetMyChallenge(id ?? '', { query: { enabled: !!id } });
  const challenge = challengeQuery.data?.status === 200 ? challengeQuery.data.data : undefined;
  const params = { challengeId: id ?? '' };
  const applicationsQuery = generated.useListManagedApplications(params, {
    query: { enabled: !!id },
  });
  const rows = useMemo(
    () => (applicationsQuery.data?.status === 200 ? applicationsQuery.data.data : []),
    [applicationsQuery.data],
  );
  const updateApplicationMutation = generated.useUpdateApplication();

  const update = async (applicationId: string, body: ApplicationPatch) => {
    try {
      await updateApplicationMutation.mutateAsync({
        id: applicationId,
        data: body as Parameters<typeof updateApplicationMutation.mutateAsync>[0]['data'],
      });
      await queryClient.invalidateQueries({
        queryKey: generated.getListManagedApplicationsQueryKey(params),
      });
    } catch {
      // 전역 MutationCache onError 토스트가 실패를 알린다.
    }
  };

  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase();
    return rows.filter(
      (row) =>
        (!evaluation || row.evaluation === evaluation) &&
        (!term ||
          row.userId.toLowerCase().includes(term) ||
          row.teammates.some((name) => name.toLowerCase().includes(term))),
    );
  }, [rows, keyword, evaluation]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  if (challengeQuery.isPending || applicationsQuery.isPending)
    return (
      <Content>
        <LoadingState label="신청서를 불러오는 중입니다." />
      </Content>
    );
  if (!challenge)
    return (
      <Content>
        <Message role="alert">행사를 찾을 수 없습니다.</Message>
        <BackLink href={hrefOf('/applications')} aria-label="신청자 응답으로 돌아가기">
          <Icon src="/assets/icons/admin-back.svg" size={24} alt="" />
          신청자 응답
        </BackLink>
      </Content>
    );

  return (
    <Content>
      <BackLink href={hrefOf('/applications')} aria-label="신청자 응답으로 돌아가기">
        <Icon src="/assets/icons/admin-back.svg" size={24} alt="" />
        신청자 응답
      </BackLink>
      <Hero>
        <Thumb aria-hidden>
          {(challenge.thumbnailUrl ?? challenge.posterUrl) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={challenge.thumbnailUrl ?? challenge.posterUrl ?? ''} alt="" />
          )}
        </Thumb>
        <HeroInfo>
          <Title>{challenge.title}</Title>
          <Meta>{challenge.organizer ?? challenge.category ?? ''}</Meta>
          <Meta>자격 / 대상 · {challengeEligibility(challenge)}</Meta>
          <Meta>
            접수기간 · {formatDate(challenge.startDate)} ~ {formatDate(challenge.endDate)}
          </Meta>
          <Buttons>
            <GhostButton
              type="button"
              onClick={() =>
                window.open(siteHref(`/contests/${challenge.id}`), '_blank', 'noopener,noreferrer')
              }
            >
              행사 프리뷰
            </GhostButton>
            <PrimaryButton
              type="button"
              onClick={() => router.push(hrefOf(`/postings/${challenge.id}/form`))}
            >
              신청서 편집
            </PrimaryButton>
          </Buttons>
        </HeroInfo>
      </Hero>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <SectionHeading>이 행사의 신청서 ({rows.length.toLocaleString()})</SectionHeading>
        <Toolbar>
          <Search
            type="search"
            value={keyword}
            placeholder="신청자 또는 팀명 검색"
            aria-label="신청자 또는 팀명 검색"
            onChange={(event) => setKeyword(event.target.value)}
          />
          <div style={{ width: 140 }}>
            <Dropdown
              options={FILTER_OPTIONS}
              value={evaluation}
              placeholder="평가상태"
              aria-label="평가상태 필터"
              size="S"
              onChange={setEvaluation}
            />
          </div>
        </Toolbar>
        <ApplicationTable
          rows={filtered}
          onUpdate={(applicationId, patch) => void update(applicationId, patch)}
          onOpen={(applicationId) =>
            setSelectedId((current) => (current === applicationId ? null : applicationId))
          }
          selectedId={selectedId}
        />
      </section>
      {selected && (
        <ApplicationResponsePanel application={selected} onClose={() => setSelectedId(null)} />
      )}
    </Content>
  );
}

const Content = styled(BizContent)({ maxWidth: 'none' });
const BackLink = styled(Link)({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  alignSelf: 'flex-start',
  ...textStyle.subtitle,
  color: c.gray900,
  '&:hover': { color: c.primary },
});
const Hero = styled.div({
  display: 'flex',
  gap: 24,
  flexWrap: 'wrap',
});
const Thumb = styled.div({
  width: 280,
  height: 158,
  flexShrink: 0,
  borderRadius: 12,
  background: c.gray100,
  overflow: 'hidden',
  '& img': { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
});
const HeroInfo = styled.div({
  flex: 1,
  minWidth: 240,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});
const Title = styled.h1({ margin: 0, ...textStyle.h2_2, color: c.gray900 });
const Meta = styled.span({ ...textStyle.caption, color: c.gray700 });
const Buttons = styled.div({ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12 });
const SectionHeading = styled.h2({ margin: 0, ...textStyle.h1_2 });
const Toolbar = styled.div({ display: 'flex', justifyContent: 'space-between', gap: 16 });
const Search = styled.input({
  width: 300,
  height: 43,
  border: 0,
  background: c.gray50,
  borderRadius: 12,
  padding: '0 16px',
  ...textStyle.metaText,
  '&:focus': { outline: 'none', background: c.paleBlue },
});
const Message = styled.p({ margin: 0, color: c.gray500 });
