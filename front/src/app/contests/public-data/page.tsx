import type { Metadata } from 'next';
import { ContestDetailPage } from '@/components/contests/ContestDetailPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: '공공데이터 공모전 - 활용 아이디어·개발 공모전 안내',
  description:
    '공공데이터 활용 공모전의 일정, 참가 자격, 시상 내역과 팀원 모집 정보를 세모챌에서 확인하세요.',
  path: '/contests/public-data',
  keywords: ['공공데이터 공모전', '공공데이터 활용 공모전', '데이터 분석 공모전'],
});

export default function Page() {
  return <ContestDetailPage />;
}
