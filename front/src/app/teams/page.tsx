import type { Metadata } from 'next';
import { ExplorePage } from '@/components/contests/ExplorePage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: '공모전 팀원 모집 - 함께할 팀원 구하기',
  description:
    '공모전·해커톤 팀원 모집글을 한눈에 확인하고 함께할 팀에 지원하세요. 기획·디자인·개발 등 역할별 공모전 팀원 구하기는 세모챌에서.',
  path: '/teams',
  keywords: ['공모전 팀원 구하기', '공모전 팀 빌딩', '해커톤 팀원'],
});

// 팀 탐색은 비로그인도 볼 수 있다. 로그인은 모집글 상세의 "팀 신청하기"에서만 요구한다.
export default async function Page({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return <ExplorePage key={role ?? ''} teamMode initialRole={role} />;
}
