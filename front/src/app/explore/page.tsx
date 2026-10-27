import type { Metadata } from 'next';
import { ExplorePage } from '@/components/contests/ExplorePage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: '공모전 찾기 - 진행 중인 공모전·대외활동 모음',
  description:
    '진행 중인 공모전과 대외활동을 분야·상금·마감일 기준으로 찾아보세요. 마감임박 공모전, 대학생 공모전, 해커톤 정보를 세모챌에서 한 번에 확인할 수 있습니다.',
  path: '/explore',
  keywords: ['공모전 찾기', '공모전 검색', '진행중인 공모전'],
});

export default function Page() {
  return <ExplorePage />;
}
