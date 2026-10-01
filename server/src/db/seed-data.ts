export type SeedChallenge = {
  id: string;
  title: string;
  description: string;
  price: number;
  capacity: number;
  category: string;
  // challenges.targets 주석의 유효값(어린이 | 초등학생 | ... | 기업)에서만 선택한다.
  targets: readonly string[];
  // challenges.organizerType 주석의 유효값에서만 선택한다.
  organizerType: string;
  // 총상금(만원). null이면 상금 미정/없음.
  prizeAmount: number | null;
  recruitMethod: 'seMOchall' | 'external';
  recruitUrl?: string;
  startOffsetDays: number;
  endOffsetDays: number;
};

export const MOCK_BUSINESS_OWNER_ID = 'f0df7998-0662-4e99-a7c6-7b084bf062e0';
export const MOCK_BUSINESS_ID = 'd94c576f-78d1-4e8b-9603-4738b92a6685';
export const MOCK_BUSINESS_EMAIL = 'seed-contests@semochal.local';

export const MOCK_CHALLENGES: readonly SeedChallenge[] = [
  {
    id: 'f3b0b09d-c8e1-4f72-9a9b-5b39f3f88501',
    title: '2026 SeMO 공공데이터 활용 아이디어 공모전',
    description: '공공데이터를 활용해 일상 문제를 해결하는 서비스 아이디어를 제안해 주세요.',
    price: 0,
    capacity: 300,
    category: 'IT/SW',
    targets: ['대학생', '대학원생', '일반인'],
    organizerType: '중앙정부/기관',
    prizeAmount: 3000,
    recruitMethod: 'seMOchall',
    startOffsetDays: -7,
    endOffsetDays: 21,
  },
  {
    id: '9090884e-229a-464f-a139-930e6d880502',
    title: '지역 관광 콘텐츠 숏폼 챌린지',
    description: '우리 동네의 매력을 알리는 60초 영상 콘텐츠를 모집합니다.',
    price: 0,
    capacity: 200,
    category: '영상/콘텐츠',
    targets: ['일반인', '제한없음'],
    organizerType: '지방자치단체',
    prizeAmount: 500,
    recruitMethod: 'external',
    recruitUrl: 'https://example.com/shortform-challenge',
    startOffsetDays: -3,
    endOffsetDays: 10,
  },
  {
    id: '998178dc-9074-4f06-80f1-a5f088f70503',
    title: '친환경 캠퍼스 디자인 공모전',
    description: '지속 가능한 캠퍼스를 위한 공간과 제품 디자인을 제안해 주세요.',
    price: 0,
    capacity: 150,
    category: '디자인',
    targets: ['대학생'],
    organizerType: '학교/재단/협회',
    prizeAmount: 1000,
    recruitMethod: 'seMOchall',
    startOffsetDays: -14,
    endOffsetDays: 35,
  },
  {
    id: '111b8f31-4195-4c84-b742-b133238b0504',
    title: '청년 창업 비즈니스 모델 경진대회',
    description: '시장성과 실행력을 갖춘 초기 창업 비즈니스 모델을 찾습니다.',
    price: 0,
    capacity: 100,
    category: '창업',
    targets: ['대학생', '일반인'],
    organizerType: '중소/벤처기업',
    prizeAmount: 5000,
    recruitMethod: 'external',
    recruitUrl: 'https://example.com/youth-bm-contest',
    startOffsetDays: -10,
    endOffsetDays: 17,
  },
  {
    id: 'ce5768ae-4073-45b4-8b8f-27624a590505',
    title: 'AI로 만드는 교육 혁신 해커톤',
    description: '생성형 AI를 활용해 더 나은 학습 경험을 만드는 팀 해커톤입니다.',
    price: 0,
    capacity: 80,
    category: 'AI/데이터',
    targets: ['고등학생', '대학생'],
    organizerType: '대기업',
    prizeAmount: 2000,
    recruitMethod: 'seMOchall',
    startOffsetDays: -1,
    endOffsetDays: 7,
  },
  {
    id: '346b34db-ab07-4ab0-9242-6ed941420506',
    title: '사회문제 해결 리서치 제안전',
    description: '지역 사회문제를 분석하고 실현 가능한 조사·정책 제안을 제출해 주세요.',
    price: 0,
    capacity: 120,
    category: '기획/아이디어',
    targets: ['대학생', '대학원생'],
    organizerType: '학회/비영리단체',
    prizeAmount: null,
    recruitMethod: 'seMOchall',
    startOffsetDays: -5,
    endOffsetDays: 28,
  },
] as const;

export function dateAfterToday(offsetDays: number, now = new Date()): Date {
  const date = new Date(now);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date;
}
