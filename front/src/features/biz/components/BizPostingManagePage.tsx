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
  TableBox,
  THead,
  TRow,
  useBizHref,
} from '@/components/biz/BizShell';
import { colors as c } from '@/styles/design';

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

  async function updateApplication(
    application: Application,
    field: 'status' | 'evaluation',
    value: string,
  ) {
    try {
      const updated = await adApi.applications.update(application.id, {
        [field]: value,
      } as Parameters<typeof adApi.applications.update>[1]);
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

  return (
    <BizContent>
      <TopRow>
        <div>
          <h1>{challenge.title}</h1>
          <p>
            {challenge.category || '카테고리 없음'} · {formatDate(challenge.startDate)} ~{' '}
            {formatDate(challenge.endDate)}
          </p>
          <Status>{challenge.status}</Status>
        </div>
        <ActionStack>
          <PrimaryButton onClick={() => router.push(hrefOf(`/postings/${challenge.id}/form`))}>
            신청폼 만들기
          </PrimaryButton>
          <OutlineButton type="button" disabled>
            공고 수정은 준비 중
          </OutlineButton>
        </ActionStack>
      </TopRow>
      {error && <Error role="alert">{error}</Error>}
      <Stats>
        <StatBox>
          <span>클릭수</span>
          <StatValue>{stats?.clicks.value ?? 0}</StatValue>
        </StatBox>
        <StatBox>
          <span>북마크</span>
          <StatValue>{stats?.bookmarks.value ?? 0}</StatValue>
        </StatBox>
        <StatBox>
          <span>모집 인원</span>
          <StatValue>{challenge.capacity}</StatValue>
        </StatBox>
      </Stats>
      <TableBox>
        <THead>
          <span>지원자 ID</span>
          <span>역할 · 상태 · 평가</span>
        </THead>
        {applications.length === 0 ? (
          <Empty>아직 지원자가 없습니다.</Empty>
        ) : (
          applications.map((application) => (
            <TRow key={application.id}>
              <span>{application.userId}</span>
              <Controls>
                <span>{application.role || '역할 미지정'}</span>
                <select
                  value={application.status}
                  onChange={(e) => void updateApplication(application, 'status', e.target.value)}
                  aria-label="지원 상태"
                >
                  {['submitted', 'reviewing', 'needs_revision', 'accepted', 'rejected'].map(
                    (value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ),
                  )}
                </select>
                <select
                  value={application.evaluation}
                  onChange={(e) =>
                    void updateApplication(application, 'evaluation', e.target.value)
                  }
                  aria-label="평가 상태"
                >
                  {['undecided', 'pass', 'fail'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Controls>
            </TRow>
          ))
        )}
      </TableBox>
    </BizContent>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}
const TopRow = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 24,
  alignItems: 'flex-start',
  marginBottom: 28,
  '& h1': { margin: 0, fontSize: 28 },
  '& p': { color: c.gray700 },
});
const ActionStack = styled.div({ display: 'flex', gap: 8, flexShrink: 0 });
const Status = styled.span({
  display: 'inline-block',
  color: c.primary,
  background: c.lightBlue,
  borderRadius: 999,
  padding: '5px 10px',
  fontSize: 12,
});
const Stats = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
  marginBottom: 28,
});
const Controls = styled.span({
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  '& select': {
    minWidth: 120,
    border: `1px solid ${c.gray300}`,
    borderRadius: 6,
    padding: '6px 8px',
    background: c.white,
  },
});
const Empty = styled.p({ padding: 24, color: c.gray700, textAlign: 'center' });
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
