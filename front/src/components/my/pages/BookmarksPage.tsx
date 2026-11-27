'use client';
import { useState } from 'react';
import { LoadingState } from '@/components/common/LoadingState';
import styled from '@emotion/styled';
import { MyShell } from '@/components/common/UserShell';
import {
  Button,
  DesktopOnly,
  MobileOnly,
  Row,
  Stack,
  Title,
  Muted,
} from '@/components/common/Primitives';
import { ContestCard, ContestGrid } from '@/components/contests/ContestCard';
import { useBookmarks } from '@/features/bookmarks/useBookmarks';
import { daysUntil, isPastDeadline } from '@/lib/date';
import { colors as c, mobile } from '@/styles/design';

export function BookmarksPage() {
  const [sort, setSort] = useState('마감임박');
  const [two, setTwo] = useState(false);
  const serverSort = sort === '인기' ? 'popular' : sort === '최신' ? 'latest' : 'deadline';
  const { bookmarks, isPending, isError } = useBookmarks(serverSort);
  // D-day 기준 시각은 마운트 시 한 번만 잡는다(렌더 중 Date.now() 호출 금지).
  const [now] = useState(() => Date.now());
  const data = bookmarks.map((challenge) => ({
    id: challenge.id ?? '',
    title: challenge.title ?? '제목 없음',
    category: challenge.category ?? '기타',
    days: daysUntil(challenge.endDate, now),
    closed: isPastDeadline(challenge.endDate, now),
    posterUrl: challenge.posterUrl ?? null,
    thumbnailUrl: challenge.thumbnailUrl ?? null,
    prizeAmount: challenge.prizeAmount ?? null,
  }));
  return (
    <MyShell title="북마크 챌린지">
      <Stack>
        <DesktopOnly>
          <Title>북마크 챌린지</Title>
        </DesktopOnly>
        <BookmarkToolbar>
          <Row>
            {['마감임박', '최신', '인기'].map((x) => (
              <SortButton
                key={x}
                tone="plain"
                small
                aria-pressed={sort === x}
                $selected={sort === x}
                onClick={() => setSort(x)}
              >
                {x}
              </SortButton>
            ))}
          </Row>
          <MobileOnly>
            <Button small tone="plain" aria-pressed={two} onClick={() => setTwo(!two)}>
              {two ? '1 열 보기' : '2 열 보기'}
            </Button>
          </MobileOnly>
        </BookmarkToolbar>
        <BookmarkGrid two={two}>
          {data.map((x) => (
            <ContestCard key={x.id} contest={x} />
          ))}
        </BookmarkGrid>
        {isPending && <LoadingState label="북마크를 불러오는 중이에요." />}
        {isError && <Muted>북마크를 불러오지 못했어요.</Muted>}
        {!isPending && !isError && data.length === 0 && <Muted>북마크한 챌린지가 없어요.</Muted>}
      </Stack>
    </MyShell>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const BookmarkGrid = styled(ContestGrid)<{ two: boolean }>(({ two }) => ({
  gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
  [mobile]: { gridTemplateColumns: two ? 'repeat(2,minmax(0,1fr))' : '1fr' },
}));
const BookmarkToolbar = styled(Row)({ justifyContent: 'space-between', flexWrap: 'wrap' });
const SortButton = styled(Button)<{ $selected?: boolean }>(({ $selected }) => ({
  color: $selected ? c.primary : c.gray500,
  border: 0,
  padding: 0,
}));
