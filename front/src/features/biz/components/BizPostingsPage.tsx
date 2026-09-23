'use client';

import { useEffect, useState } from 'react';
import type { Challenge, ChallengeStats } from '@semochal/api-client';
import styled from '@emotion/styled';
import { adApi } from '@/lib/ad-api';
import { colors as c } from '@/styles/design';
import {
  BizContent,
  SectionHeader,
  SectionTitle,
  PrimaryButton,
  TableBox,
  TRow,
  useBizHref,
} from '@/components/biz/BizShell';

export function BizPostingsPage() {
  const hrefOf = useBizHref();
  const [items, setItems] = useState<Challenge[]>([]);
  const [stats, setStats] = useState<ChallengeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    void adApi.businesses
      .listMyChallenges()
      .then(async ({ items: challenges }) => {
        setItems(challenges);
        if (challenges[0]) setStats(await adApi.challenges.getStats(challenges[0].id));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  const latest = items[0];
  return (
    <BizContent>
      <SectionHeader>
        <SectionTitle>공고 관리</SectionTitle>
        <PrimaryButton onClick={() => (window.location.href = hrefOf('/postings/new'))}>
          챌린지 추가
        </PrimaryButton>
      </SectionHeader>
      {loading && <Message>공고를 불러오는 중입니다.</Message>}
      {error && <Message>공고를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</Message>}
      {!loading && !error && !latest && <Message>등록된 공고가 없습니다.</Message>}
      {latest && (
        <Summary>
          <strong>{latest.title}</strong>
          <span>
            {new Date(latest.startDate).toLocaleDateString('ko-KR')} ~{' '}
            {new Date(latest.endDate).toLocaleDateString('ko-KR')}
          </span>
          <span>조회 {stats?.clicks.value ?? 0}회</span>
        </Summary>
      )}
      {!loading && items.length > 0 && (
        <TableBox>
          {items.map((item) => (
            <TRow key={item.id}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong>{item.title}</strong>
                <small>
                  {item.category ?? '미분류'} · {item.status}
                </small>
              </div>
              <a href={hrefOf(`/postings/${item.id}`)}>관리</a>
            </TRow>
          ))}
        </TableBox>
      )}
    </BizContent>
  );
}

const Summary = styled.div({
  display: 'flex',
  gap: 24,
  alignItems: 'center',
  padding: 24,
  border: `1px solid ${c.gray100}`,
  borderRadius: 12,
  color: c.gray700,
  '& strong': { color: c.gray900, fontSize: 22 },
});
const Message = styled.p({ color: c.gray500, padding: '48px 0', textAlign: 'center' });
