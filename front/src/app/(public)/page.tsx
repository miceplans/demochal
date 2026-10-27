import type { Metadata } from 'next';
import { SITE_OPEN_GRAPH } from '@/lib/seo';
import { HomePage as UserHomePage } from '@/components/home/HomePage';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: { ...SITE_OPEN_GRAPH, url: '/' },
};

// 본문은 클라이언트에서 그려지므로, 크롤러가 서버 HTML에서 주제를 읽도록 시각적으로 숨긴 h1/설명을 둔다.
const srOnly = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

export default function HomePage() {
  return (
    <>
      <div style={srOnly}>
        <h1>공모전 사이트 세모챌 - 전국 공모전·대외활동 모아보기</h1>
        <p>
          세모챌은 진행 중인 공모전, 마감임박 공모전, 대학생 공모전, 대외활동, 해커톤, 공공데이터
          공모전을 한곳에 모은 공모전 사이트입니다. 공모전 팀원 모집까지 함께 이용해 보세요.
        </p>
      </div>
      <UserHomePage />
    </>
  );
}
