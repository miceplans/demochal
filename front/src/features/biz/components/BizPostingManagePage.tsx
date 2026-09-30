'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { adApi, adError } from '@/lib/ad-api';
import type { Application, Challenge, ChallengeStats } from '@semochal/api-client';
import {
  BizContent,
  PrimaryButton,
  OutlineButton,
  StatBox,
  StatValue,
  Delta,
  useBizHref,
} from '@/components/biz/BizShell';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { ApplicationTable, type ApplicationPatch } from './ApplicationTable';

export function BizPostingManagePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hrefOf = useBizHref();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [nextChallenge, nextStats, nextApplications] = await Promise.all([
        adApi.challenges.get(id),
        adApi.challenges.getStats(id),
        adApi.applications.listManaged({ challengeId: id }),
      ]);
      setChallenge(nextChallenge);
      setStats(nextStats);
      setApplications(nextApplications);
    } catch (cause) {
      setError(adError(cause));
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    // Loading is an external API synchronization triggered by the route.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function updateApplication(application: Application, patch: ApplicationPatch) {
    try {
      const updated = await adApi.applications.update(application.id, patch);
      setApplications((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
    } catch (cause) {
      setError(adError(cause));
    }
  }

  if (loading)
    return (
      <BizContent>
        <Message>공고 정보를 불러오는 중입니다.</Message>
      </BizContent>
    );
  if (error && !challenge)
    return (
      <BizContent>
        <Message>
          {error}
          <button type="button" onClick={() => void load()}>
            다시 시도
          </button>
        </Message>
      </BizContent>
    );
  if (!challenge)
    return (
      <BizContent>
        <Message>공고를 찾을 수 없습니다.</Message>
      </BizContent>
    );

  const delta = (value?: number) => `${(value ?? 0) >= 0 ? '+' : ''}${value ?? 0}% 전주 대비`;
  return (
    <BizContent>
      <Top>
        <Main>
          <Thumb aria-hidden />
          <Info>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PostingTitle>{challenge.title}</PostingTitle>
              <PostingOrg>{challenge.organizer ?? challenge.category ?? ''}</PostingOrg>
            </div>
            <Facts>
              <Fact>
                <strong>자격 / 대상</strong>
                <span>{challenge.eligibility ?? '—'}</span>
              </Fact>
              <Fact>
                <strong>접수기간</strong>
                <span>
                  {formatDate(challenge.startDate)} ~ {formatDate(challenge.endDate)}
                </span>
              </Fact>
            </Facts>
          </Info>
        </Main>
        <Side>
          <PrimaryButton onClick={() => router.push(hrefOf(`/postings/${challenge.id}/form`))}>
            신청폼 만들기
          </PrimaryButton>
          <OutlineButton
            type="button"
            onClick={() => router.push(hrefOf(`/postings/${challenge.id}/edit`))}
          >
            챌린지 편집하기
          </OutlineButton>
          <SideStat>
            <StatLabel>클릭수</StatLabel>
            <StatValue>{(stats?.clicks.value ?? 0).toLocaleString()}번</StatValue>
            <Delta>{delta(stats?.clicks.deltaPercent)}</Delta>
          </SideStat>
          <SideStat>
            <StatLabel>북마크</StatLabel>
            <StatValue>{(stats?.bookmarks.value ?? 0).toLocaleString()}개</StatValue>
            <Delta>{delta(stats?.bookmarks.deltaPercent)}</Delta>
          </SideStat>
        </Side>
      </Top>
      {error && <Error role="alert">{error}</Error>}
      <ApplicationTable
        rows={applications}
        onUpdate={(applicationId, patch) => {
          const target = applications.find((row) => row.id === applicationId);
          if (target) void updateApplication(target, patch);
        }}
      />
    </BizContent>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}
const Top = styled.div({ display: 'flex', gap: 32, alignItems: 'flex-start' });
const Main = styled.div({
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 24,
});
const Thumb = styled.div({ height: 247, borderRadius: 18, background: c.gray100 });
const Info = styled.div({ display: 'flex', justifyContent: 'space-between', gap: 24 });
const PostingTitle = styled.h1({ margin: 0, fontSize: 22, fontWeight: 700, color: c.gray900 });
const PostingOrg = styled.span({ ...textStyle.body, color: c.gray700 });
const Facts = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  ...textStyle.finePrint,
});
const Fact = styled.div({
  display: 'flex',
  gap: 9,
  '& strong': { color: c.gray900, fontWeight: 600 },
  '& span': { color: c.gray700 },
});
const Side = styled.div({
  width: 269,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});
const SideStat = styled(StatBox)({ height: 148, marginTop: 8, borderRadius: 12 });
const StatLabel = styled.span({ ...textStyle.metaText, color: c.gray700 });
const Message = styled.div({
  padding: 40,
  textAlign: 'center',
  color: c.gray700,
  '& button': {
    marginLeft: 12,
    color: c.primary,
    textDecoration: 'underline',
    background: 'none',
    border: 0,
  },
});
const Error = styled.p({ color: c.red, marginBottom: 16 });
