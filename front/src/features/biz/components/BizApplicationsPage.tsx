'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import styled from '@emotion/styled';
import { generated } from '@semochal/api-client';
import { LoadingState } from '@/components/common/LoadingState';
import { BizContent, StatBox, useBizHref } from '@/components/biz/BizShell';
import { apiErrorMessage } from '@/lib/api-error';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';

const formatDate = (iso: string) => iso.slice(0, 10).replaceAll('-', '.');

/** 신청자 응답 — 행사(공고)별 신청 현황 목록. 행사를 누르면 해당 행사의 신청서 뷰로 들어간다. */
export function BizApplicationsPage() {
  const hrefOf = useBizHref();
  const challengesQuery = generated.useListMyChallenges();
  const applicationsQuery = generated.useListManagedApplications();
  const challenges = useMemo(
    () => (challengesQuery.data?.status === 200 ? (challengesQuery.data.data.items ?? []) : []),
    [challengesQuery.data],
  );
  const applications = useMemo(
    () => (applicationsQuery.data?.status === 200 ? applicationsQuery.data.data : []),
    [applicationsQuery.data],
  );
  const loading = challengesQuery.isPending || applicationsQuery.isPending;
  const error =
    challengesQuery.isError || applicationsQuery.isError
      ? apiErrorMessage(
          challengesQuery.error ?? applicationsQuery.error,
          '신청자 응답을 불러오지 못했습니다.',
        )
      : null;

  const byChallenge = useMemo(() => {
    const map = new Map<string, { total: number; reviewing: number; accepted: number }>();
    for (const row of applications) {
      const entry = map.get(row.challengeId) ?? { total: 0, reviewing: 0, accepted: 0 };
      entry.total += 1;
      if (row.status === 'reviewing') entry.reviewing += 1;
      if (row.status === 'accepted') entry.accepted += 1;
      map.set(row.challengeId, entry);
    }
    return map;
  }, [applications]);

  const count = (predicate: (row: (typeof applications)[number]) => boolean) =>
    applications.filter(predicate).length;
  const stats = [
    { label: '전체 응답 수', value: applications.length },
    { label: '제출 완료 수', value: count((r) => r.status !== 'pending') },
    { label: '검토 중', value: count((r) => r.status === 'reviewing') },
    { label: '선정', value: count((r) => r.status === 'accepted') },
    { label: '미선정', value: count((r) => r.status === 'rejected') },
  ];

  return (
    <Content>
      <PageHeading>신청자 응답</PageHeading>
      <Stats aria-label="지원 현황 요약">
        {stats.map((stat) => (
          <Stat key={stat.label}>
            <StatLabel>{stat.label}</StatLabel>
            <StatValue>{stat.value.toLocaleString()}</StatValue>
          </Stat>
        ))}
      </Stats>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <SectionHeading>행사별 신청 현황</SectionHeading>
        {loading && <LoadingState label="신청자 응답을 불러오는 중입니다." />}
        {error && <Message role="alert">{error}</Message>}
        {!loading && !error && challenges.length === 0 && (
          <Message>등록된 행사가 없습니다.</Message>
        )}
        <List>
          {challenges.map((challenge) => {
            const entry = byChallenge.get(challenge.id) ?? { total: 0, reviewing: 0, accepted: 0 };
            return (
              <li key={challenge.id}>
                <Card href={hrefOf(`/applications/${challenge.id}`)}>
                  <Thumb aria-hidden>
                    {(challenge.thumbnailUrl ?? challenge.posterUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={challenge.thumbnailUrl ?? challenge.posterUrl ?? ''} alt="" />
                    )}
                  </Thumb>
                  <CardInfo>
                    <CardTitle>{challenge.title}</CardTitle>
                    <CardMeta>
                      접수 {formatDate(challenge.startDate)} ~ {formatDate(challenge.endDate)}
                    </CardMeta>
                  </CardInfo>
                  <Counts>
                    <Count>
                      <strong>{entry.total.toLocaleString()}</strong>
                      <span>신청</span>
                    </Count>
                    <Count>
                      <strong>{entry.reviewing.toLocaleString()}</strong>
                      <span>검토 중</span>
                    </Count>
                    <Count>
                      <strong>{entry.accepted.toLocaleString()}</strong>
                      <span>선정</span>
                    </Count>
                  </Counts>
                  <Go aria-hidden>신청서 보기 →</Go>
                </Card>
              </li>
            );
          })}
        </List>
      </section>
    </Content>
  );
}

const Content = styled(BizContent)({ maxWidth: 'none' });
const PageHeading = styled.h1({ margin: 0, ...textStyle.display, color: c.gray900 });
const Stats = styled.div({ display: 'flex', gap: 24, flexWrap: 'wrap' });
const Stat = styled(StatBox)({ flex: 1, border: 0, background: c.gray50 });
const StatLabel = styled.span({ ...textStyle.caption, color: c.gray700 });
const StatValue = styled.strong({ fontSize: 28, fontWeight: 700, color: c.gray900 });
const SectionHeading = styled.h2({ margin: 0, ...textStyle.h1_2 });
const List = styled.ul({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});
const Card = styled(Link)({
  display: 'flex',
  alignItems: 'center',
  gap: 20,
  padding: 16,
  borderRadius: 12,
  background: c.gray50,
  transition: 'background 0.15s',
  '&:hover': { background: c.paleBlue },
});
const Thumb = styled.div({
  width: 120,
  height: 68,
  flexShrink: 0,
  borderRadius: 8,
  background: c.gray100,
  overflow: 'hidden',
  '& img': { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
});
const CardInfo = styled.div({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
});
const CardTitle = styled.strong({
  ...textStyle.h2,
  color: c.gray900,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});
const CardMeta = styled.span({ ...textStyle.metaText, color: c.gray500 });
const Counts = styled.div({ display: 'flex', gap: 24 });
const Count = styled.div({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  '& strong': { fontSize: 20, fontWeight: 700, color: c.gray900 },
  '& span': { ...textStyle.metaText, color: c.gray500 },
});
const Go = styled.span({
  ...textStyle.overline,
  color: c.primary,
  padding: '8px 12px',
  borderRadius: 6,
  background: c.paleBlue,
  whiteSpace: 'nowrap',
});
const Message = styled.p({ margin: 0, color: c.gray500 });
