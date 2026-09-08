'use client';

import styled from '@emotion/styled';
import { useChallengesInfinite } from '../api/queries';
import { VirtualList } from '@/components/data/VirtualList';
import { Button } from '@/components/ui/Button';
import { textStyle } from '@/styles/typography';

const Layout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
`;

const Card = styled.div`
  padding: 16px;
  border: 1px solid ${(p) => p.theme.colors.gray[200]};
  border-radius: 12px;
  background: ${(p) => p.theme.colors.background};
`;

const Title = styled.div`
  font-size: ${textStyle.h2.fontSize}px;
  font-weight: ${textStyle.h2.fontWeight};
  color: ${(p) => p.theme.colors.gray[900]};
  margin-bottom: 4px;
`;

const Meta = styled.div`
  font-size: 13px;
  color: ${(p) => p.theme.colors.gray[500]};
`;

const Price = styled.span`
  color: ${(p) => p.theme.colors.semo};
  font-weight: 700;
`;

const StatusText = styled.div<{ tone: 'error' | 'muted' }>`
  padding: 24px 0;
  text-align: center;
  font-size: 14px;
  color: ${(p) => (p.tone === 'error' ? p.theme.colors.red : p.theme.colors.gray[500])};
`;

// Infinite-scroll challenge feed: useInfiniteQuery + virtualized rows.
// The VirtualList triggers fetchNextPage when the scroll nears the bottom.
export function ChallengeInfiniteList() {
  const { data, error, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, status } =
    useChallengesInfinite();

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  if (status === 'pending') {
    return <StatusText tone="muted">불러오는 중...</StatusText>;
  }

  if (status === 'error') {
    return (
      <StatusText tone="error">챌린지 목록을 불러오지 못했습니다. ({error.message})</StatusText>
    );
  }

  return (
    <Layout>
      <VirtualList
        items={items}
        height={520}
        estimateSize={() => 96}
        onEndReached={() => {
          if (hasNextPage && !isFetching) void fetchNextPage();
        }}
        renderItem={(challenge) => (
          <div style={{ paddingBottom: 12 }}>
            <Card>
              <Title>{challenge.title}</Title>
              <Meta>
                <Price>{challenge.price.toLocaleString()}원</Price> · 수용 {challenge.capacity}명 ·{' '}
                {new Date(challenge.startDate).toLocaleDateString('ko-KR')} ~{' '}
                {new Date(challenge.endDate).toLocaleDateString('ko-KR')}
              </Meta>
            </Card>
          </div>
        )}
      />
      {isFetchingNextPage ? <StatusText tone="muted">더 불러오는 중...</StatusText> : null}
      {!hasNextPage && items.length > 0 ? (
        <StatusText tone="muted">마지막 챌린지입니다.</StatusText>
      ) : null}
      {hasNextPage && !isFetching ? (
        <Button variant="secondary" onClick={() => void fetchNextPage()}>
          더 보기
        </Button>
      ) : null}
    </Layout>
  );
}
