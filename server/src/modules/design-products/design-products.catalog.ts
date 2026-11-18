// 디자인 상품 카탈로그. 금액은 반드시 서버 값만 신뢰한다(클라이언트가 보낸 금액은 받지 않는다).
// 기존 코드(poster, opening_video)는 과거 주문 행(orders.design_product)이 참조하므로 바꾸지 않는다.
// TODO: 상품이 늘거나 가격을 운영에서 바꿔야 하면 DB 테이블 + 어드민 화면으로 이관한다.
export const DESIGN_PRODUCTS = [
  {
    code: 'poster',
    name: '포스터 시안 제작',
    description: '챌린지 포스터 시안을 제작해 드립니다.',
    price: 500_000,
  },
  {
    code: 'poster_print',
    name: '포스터 디자인 + 인쇄 (A2 100부)',
    description: '포스터 디자인부터 A2 100부 인쇄·배송까지 한 번에 진행합니다.',
    price: 900_000,
  },
  {
    code: 'key_visual_3',
    name: '키비주얼 시안 (3종)',
    description: '행사 톤앤매너를 담은 키비주얼 시안 3종을 제안해 드립니다.',
    price: 1_200_000,
  },
  {
    code: 'key_visual_10',
    name: '키비주얼 시안 (10종)',
    description: '다양한 콘셉트의 키비주얼 시안 10종을 제안하고 1종을 확정 디자인합니다.',
    price: 3_500_000,
  },
  {
    code: 'opening_video_1m',
    name: '오프닝 영상 (1분)',
    description: '시상식·행사용 1분 오프닝 영상을 제작해 드립니다.',
    price: 1_500_000,
  },
  {
    code: 'opening_video',
    name: '오프닝 영상 (3분)',
    description: '시상식·행사용 3분 오프닝 영상을 제작해 드립니다.',
    price: 3_000_000,
  },
  {
    code: 'opening_video_5m',
    name: '오프닝 영상 (5분)',
    description: '시상식·행사용 5분 오프닝 영상을 제작해 드립니다.',
    price: 4_500_000,
  },
  {
    code: 'highlight_video',
    name: '행사 하이라이트 영상 (2분)',
    description: '행사 현장 촬영본으로 2분 하이라이트 영상을 편집해 드립니다.',
    price: 2_000_000,
  },
  {
    code: 'logo_motion',
    name: '로고 모션 (10초)',
    description: '행사·브랜드 로고에 10초 모션을 입혀 드립니다.',
    price: 700_000,
  },
  {
    code: 'event_bi',
    name: '행사 BI(로고) 디자인',
    description: '행사 전용 로고와 기본 활용 가이드를 제작해 드립니다.',
    price: 1_500_000,
  },
  {
    code: 'card_news',
    name: '카드뉴스 (10장)',
    description: 'SNS 홍보용 카드뉴스 10장을 제작해 드립니다.',
    price: 400_000,
  },
  {
    code: 'sns_banner_set',
    name: 'SNS 홍보 배너 세트 (5종)',
    description: '인스타그램·블로그·유튜브 등 채널별 홍보 배너 5종을 제작해 드립니다.',
    price: 300_000,
  },
  {
    code: 'event_signage',
    name: '현수막·배너 디자인 세트',
    description: '현수막, X배너, 포토월 디자인을 한 세트로 제작해 드립니다.',
    price: 600_000,
  },
  {
    code: 'certificate',
    name: '상장·수료증 디자인',
    description: '시상식용 상장과 참가자 수료증 디자인을 제작해 드립니다.',
    price: 300_000,
  },
] as const;

export type DesignProductCode = (typeof DESIGN_PRODUCTS)[number]['code'];

export const DESIGN_PRODUCT_CODES = DESIGN_PRODUCTS.map((p) => p.code) as DesignProductCode[];
