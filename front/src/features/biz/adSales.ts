// 광고 판매 기능 노출 여부. 기본은 숨김이며, NEXT_PUBLIC_AD_SALES_ENABLED=true로 빌드하면 메뉴·라우트·대시보드 영역이 복구된다.
export const AD_SALES_ENABLED = process.env.NEXT_PUBLIC_AD_SALES_ENABLED === 'true';
