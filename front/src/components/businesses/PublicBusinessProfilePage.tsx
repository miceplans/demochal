'use client';

import { useState } from 'react';
import { ApiError, generated } from '@semochal/api-client';
import styled from '@emotion/styled';
import { UserShell, Content } from '@/components/common/UserShell';
import { LoadingState } from '@/components/common/LoadingState';
import { NotFound } from '@/components/common/NotFound';
import { Muted, Tag } from '@/components/common/Primitives';
import type { BadgeTone } from '@/components/ui/Badge';
import { BizOrgProfile } from '@/components/biz/BizOrgProfile';
import { ContestCard, ContestGrid } from '@/components/contests/ContestCard';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { daysUntil, isPastDeadline } from '@/lib/date';

// 서버 displayStatus는 verified→'승인', rejected→'반려'를 내린다(server business-status.ts).
// 그 외 값(레거시 가승인 등)이 날아와도 뱃지가 깨지지 않도록 amber으로 폰백한다.
const verificationTone = (displayStatus?: string): BadgeTone =>
  displayStatus === '승인' ? 'green' : displayStatus === '반려' ? 'red' : 'amber';

interface IntroBlock {
  type?: string;
  content?: Record<string, unknown>;
}

// contentBlocks 편집기가 아직 없어 실제로는 빈 배열이지만, 저장된 블록이 있으면 읽기 전용으로 보여준다.
function IntroBlocks({ blocks }: { blocks?: readonly IntroBlock[] }) {
  if (!blocks?.length) return null;
  return (
    <Intro>
      <IntroTitle>소개</IntroTitle>
      {blocks.map((block, index) => {
        const content = block.content ?? {};
        if (block.type === 'text' && typeof content.text === 'string') {
          return <IntroText key={index}>{content.text}</IntroText>;
        }
        if (block.type === 'link' && typeof content.url === 'string') {
          const label = typeof content.label === 'string' ? content.label : content.url;
          return (
            <IntroLink key={index} href={content.url} target="_blank" rel="noreferrer">
              {label}
            </IntroLink>
          );
        }
        return null;
      })}
    </Intro>
  );
}

// 승인(verified) 기관명 옆의 파란 인증 체크 — 흰 체크 아이콘을 파란 원 안에 둔다.
function VerifiedMark() {
  return (
    <VerifiedBadge title="인증된 기관">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/icons/check.svg" alt="인증된 기관" width={11} height={11} />
    </VerifiedBadge>
  );
}

function LoadError() {
  return (
    <UserShell title="기업 프로필" back="/explore">
      <Content>
        <Muted role="alert">기업 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</Muted>
      </Content>
    </UserShell>
  );
}

export function PublicBusinessProfilePage({ businessId }: { businessId: string }) {
  const businessQuery = generated.useGetPublicBusiness(businessId);
  const challengesQuery = generated.useGetPublicBusinessChallenges(businessId);
  // D-day 계산 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  const business = businessQuery.data?.status === 200 ? businessQuery.data.data : undefined;
  const challengeItems =
    challengesQuery.data?.status === 200 ? challengesQuery.data.data : undefined;
  if (businessQuery.isLoading) {
    return (
      <UserShell title="기업 프로필" back="/explore">
        <Content>
          <LoadingState label="기업 정보를 불러오는 중이에요" />
        </Content>
      </UserShell>
    );
  }
  if (businessQuery.isError) {
    const notFound = businessQuery.error instanceof ApiError && businessQuery.error.status === 404;
    if (notFound) return <NotFound homeHref="/explore" />;
    return <LoadError />;
  }
  // 비-2xx 응답은 ApiError로 throw되므로 data가 있으면 200이다. 타입 좁히기용 방어 분기다.
  if (!business) return <LoadError />;
  return (
    <UserShell title={business.name ?? '기업 프로필'} back="/explore">
      <Content style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <BizOrgProfile
          bannerUrl={business.bannerUrl ?? null}
          logoUrl={business.logoUrl ?? null}
          name={
            <NameWrap>
              <span>{business.name ?? '이름 없는 기업'}</span>
              {business.displayStatus === '승인' ? <VerifiedMark /> : null}
              {business.displayStatus ? (
                <Tag tone={verificationTone(business.displayStatus)}>{business.displayStatus}</Tag>
              ) : null}
            </NameWrap>
          }
          address={business.address}
          phone={business.phone}
          email={business.email}
        />
        <IntroBlocks blocks={business.contentBlocks} />
        <ChallengeSection items={challengeItems} loading={challengesQuery.isLoading} now={now} />
      </Content>
    </UserShell>
  );
}

// 이 기관의 챌린지 — 목록 로딩 중·오류·빈 목록이면 섹션을 숨긴다(프로필이 본체다).
function ChallengeSection({
  items,
  loading,
  now,
}: {
  items?: {
    id: string;
    title: string;
    category?: string | null;
    endDate: string;
    posterUrl: string | null;
  }[];
  loading: boolean;
  now: number;
}) {
  if (loading) {
    return (
      <Intro>
        <IntroTitle>이 기관의 챌린지</IntroTitle>
        <Muted>챌린지를 불러오는 중이에요</Muted>
      </Intro>
    );
  }
  if (!items?.length) return null;
  return (
    <Intro>
      <IntroTitle>이 기관의 챌린지</IntroTitle>
      <ContestGrid>
        {items.map((item) => (
          <ContestCard
            key={item.id}
            href={`/contests/${item.id}`}
            contest={{
              id: item.id,
              title: item.title,
              category: item.category ?? '',
              days: daysUntil(item.endDate, now),
              closed: isPastDeadline(item.endDate, now),
              posterUrl: item.posterUrl,
            }}
          />
        ))}
      </ContestGrid>
    </Intro>
  );
}

const NameWrap = styled.span({ display: 'inline-flex', alignItems: 'center', gap: 8 });
const VerifiedBadge = styled.span({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: c.primary,
  flexShrink: 0,
});
const Intro = styled.section({ display: 'flex', flexDirection: 'column', gap: 12 });
const IntroTitle = styled.h2({ margin: 0, ...textStyle.h2, color: c.gray900 });
const IntroText = styled.p({
  margin: 0,
  ...textStyle.body,
  color: c.gray900,
  whiteSpace: 'pre-line',
});
const IntroLink = styled.a({
  ...textStyle.body,
  color: c.primary,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
});
