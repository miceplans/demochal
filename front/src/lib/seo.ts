import type { Metadata } from 'next';

/** 색인 가치가 없는 페이지(개인·인증·결제·작성 폼 등)용 robots 메타데이터. */
export const noIndexMetadata: Metadata = {
  robots: { index: false, follow: false },
};
