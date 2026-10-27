import type { Metadata } from 'next';

/** 색인 가치가 없는 페이지(개인·인증·결제·작성 폼 등)용 robots 메타데이터. */
export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false },
};

export const SITE_NAME = '세모챌';
export const SITE_TITLE = '공모전 사이트 세모챌 - 전국 공모전·대외활동 모아보기';
export const SITE_DESCRIPTION =
  '공모전 사이트 세모챌에서 진행 중인 공모전, 대외활동, 해커톤, 공공데이터 공모전을 한눈에 모아보고 팀원까지 구하세요. 마감임박 공모전과 상금·분야별 공모전 정보를 매일 업데이트합니다.';
export const SITE_KEYWORDS = [
  '공모전',
  '공모전 사이트',
  '공모전 모음',
  '공모전 추천',
  '공모전 일정',
  '마감임박 공모전',
  '대학생 공모전',
  '대외활동',
  '해커톤',
  '공모전 팀원 모집',
  '공공데이터 공모전',
  '세모챌',
];

/** 루트 openGraph 기본값 — 페이지 메타데이터는 shallow merge라 openGraph를 덮어쓸 때 이 객체를 펼쳐 쓴다. */
export const SITE_OPEN_GRAPH = {
  type: 'website',
  locale: 'ko_KR',
  siteName: SITE_NAME,
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
} as const;

/** 공통 OG/Twitter 필드를 채운 페이지 메타데이터. canonical은 metadataBase 기준 상대 경로. */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const { title, description, path, keywords } = opts;
  return {
    title,
    description,
    keywords: keywords ? [...keywords, ...SITE_KEYWORDS] : SITE_KEYWORDS,
    alternates: { canonical: path },
    openGraph: { ...SITE_OPEN_GRAPH, title, description, url: path },
    twitter: { card: 'summary_large_image', title, description },
  };
}
