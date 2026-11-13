// 디자인 상품 카탈로그. 금액은 반드시 서버 값만 신뢰한다(클라이언트가 보낸 금액은 받지 않는다).
// TODO: 상품이 늘거나 가격을 운영에서 바꿔야 하면 DB 테이블 + 어드민 화면으로 이관한다.
export const DESIGN_PRODUCTS = [
  {
    code: 'poster',
    name: '포스터 시안 제작',
    description: '챌린지 포스터 시안을 제작해 드립니다.',
    price: 500_000,
  },
  {
    code: 'opening_video',
    name: '오프닝 영상 (3분)',
    description: '시상식·행사용 3분 오프닝 영상을 제작해 드립니다.',
    price: 3_000_000,
  },
] as const;

export type DesignProductCode = (typeof DESIGN_PRODUCTS)[number]['code'];

export const DESIGN_PRODUCT_CODES = DESIGN_PRODUCTS.map((p) => p.code) as DesignProductCode[];
