// 유저 페이지 목업 데이터 — Figma "세모챌" 디자인 기반. 실제 데이터는 유저 API 연동 시 교체 (TODO).
// 분류 값은 서버 DTO enum과 1:1 — api-client 공개 타입에서 파생해 폼/필터가 캐스트 없이 쓸 수 있다.
import type { generated } from '@semochal/api-client';

export type Contest = {
  id: string;
  title: string;
  category: string;
  days: number;
  /** 팀 모집 수. 알 수 없으면(API 추천 등) 생략하고 카드에서 배지를 숨긴다. */
  teams?: number;
};
export const contests: Contest[] = [
  { id: 'contest-1', title: '2025 공공데이터 활용 대회', category: 'IT/SW', days: 7, teams: 3 },
  { id: 'contest-2', title: '청년 창업 아이디어 챌린지', category: '창업', days: 12, teams: 5 },
  { id: 'contest-3', title: '글로벌 스타트업 챌린지', category: '창업', days: 20, teams: 2 },
  { id: 'contest-4', title: 'AI 이미지 인식 해커톤', category: 'IT/SW', days: 9, teams: 4 },
  { id: 'contest-5', title: '디자인 씽킹 해커톤', category: '디자인', days: 7, teams: 1 },
  { id: 'contest-6', title: '빅데이터 분석 경진대회', category: 'IT/SW', days: 7, teams: 3 },
  { id: 'contest-7', title: '숏폼 영상 크리에이터 챌린지', category: '영상', days: 12, teams: 2 },
  { id: 'contest-8', title: 'SNS 마케팅 아이디어 챌린지', category: '마케팅', days: 5, teams: 4 },
];
export const desktopContests = Array.from({ length: 8 }, (_, i) => ({
  ...contests[0],
  id: `contest-${i + 1}`,
}));
// 팀 모집글 커버는 해당 챌린지 포스터를 쓴다(챌린지 상세 contestDetail.poster와 동일 목 이미지).
const mockChallengePoster = '/mock/mock-poster.png';
export type Team = {
  id: string;
  name: string;
  challenge: string;
  region?: string;
  poster: string;
  members: string;
  joined: number;
  capacity: number;
  filledRoles: string[];
  recruitingRoles: string[];
};
export const teams: Team[] = [
  {
    id: 'team-1',
    name: '프로젝트팀 A',
    poster: mockChallengePoster,
    challenge: 'OO챌린지',
    members: '2/4명 참여중',
    joined: 2,
    capacity: 4,
    filledRoles: ['기획', '프론트엔드'],
    recruitingRoles: ['백엔드', '디자이너'],
  },
  {
    id: 'team-2',
    name: '프로젝트팀 B',
    poster: mockChallengePoster,
    challenge: 'AI 해커톤',
    members: '3/5명 참여중',
    joined: 3,
    capacity: 5,
    filledRoles: ['기획', '프론트엔드'],
    recruitingRoles: ['백엔드', '디자이너'],
  },
  {
    id: 'team-3',
    name: '프로젝트팀 C',
    poster: mockChallengePoster,
    challenge: '공공데이터 챌린지',
    members: '1/4명 참여중',
    joined: 1,
    capacity: 4,
    filledRoles: ['기획', '디자이너'],
    recruitingRoles: ['백엔드', '프론트엔드'],
  },
  {
    id: 'team-4',
    name: '프로젝트팀 D',
    poster: mockChallengePoster,
    challenge: '청년 창업 챌린지',
    members: '2/5명 참여중',
    joined: 2,
    capacity: 5,
    filledRoles: ['기획', '백엔드'],
    recruitingRoles: ['프론트엔드', '디자이너'],
  },
];
export const categories = [
  'IT/SW',
  '디자인',
  '창업/취업',
  '기획',
  '문학',
  '논문',
  '사진',
  '음악',
  '과학',
  '건축',
  '광고/마케팅',
  '이벤트',
  '대회',
  '네이밍/슬로건',
  '만화/캐릭터',
  '미술',
  '영상/UCC',
  '해외',
];
export const challengeTargets: NonNullable<generated.UpdateChallengeMutationBody['targets']> = [
  '어린이',
  '초등학생',
  '중학생',
  '고등학생',
  '대학생',
  '대학원생',
  '제한없음',
  '지역제한',
  '일반인',
  '기업',
];
export const organizerTypes: NonNullable<generated.UpdateChallengeMutationBody['organizerType']>[] =
  [
    '중앙정부/기관',
    '대기업',
    '외국계기업',
    '학교/재단/협회',
    '학회/비영리단체',
    '진흥원',
    '언론',
    '지방자치단체',
    '중소/벤처기업',
    '기타',
  ];
export const roles = [
  '프론트엔드',
  '백엔드',
  '풀스택',
  '모바일',
  '디자이너',
  '기획자',
  '데이터/AI',
  '마케터',
  '영상/콘텐츠',
  '기타',
];
// 팀 탐색 지역 필터 — 도 단위로 묶고, 팀에 저장된 지역명(시·도 자유 입력)을 members로 매칭한다.
export const regionGroups = [
  { label: '서울', members: ['서울'] },
  { label: '경기/인천', members: ['경기', '인천'] },
  { label: '강원', members: ['강원'] },
  { label: '충청', members: ['대전', '세종', '충북', '충남', '충청'] },
  { label: '전라', members: ['광주', '전북', '전남', '전라'] },
  { label: '경상', members: ['부산', '대구', '울산', '경북', '경남', '경상'] },
  { label: '제주', members: ['제주'] },
];

export const skillCatalog = [
  'React',
  'TypeScript',
  'JavaScript',
  'Next.js',
  'Vue',
  'Node.js',
  'Python',
  'Java',
  'Kotlin',
  'Swift',
  'Go',
  'Django',
  'Spring',
  'Express',
  'GraphQL',
  'Figma',
  'Photoshop',
  'AWS',
  'Docker',
  'Kubernetes',
  'Git',
  'MySQL',
  'PostgreSQL',
  'MongoDB',
  'TensorFlow',
  'Pandas',
  'Flutter',
  'Unity',
];
// TODO: '선호 역할'(roles)/'참가 대상'(audience) 칩 그룹은 서버에 저장·조회하는 필드가
// 없어(zustand 로컬 상태만 바뀌는 죽은 UI) 제거했다. users 스키마에 해당 값을 저장하는
// API가 생기면 그룹을 되살리고 아래 useUserStore의 roles/audience도 함께 복원한다.
export const preferenceGroups = [
  {
    key: 'interests' as const,
    title: '챌린지 분야',
    options: [
      'IT · 소프트웨어',
      '데이터 · AI',
      '디자인 · UX',
      '영상 · 콘텐츠',
      '마케팅 · 광고',
      '건축 · 도시',
      '환경 · ESG',
      '문학 · 글쓰기',
      '음악 · 공연',
    ],
  },
];
// TODO: '새 수상작' 알림 스위치(award)는 서버에 수상작 알림 로직이 없어(#327 out of
// scope) 아직 복원하지 않았다. 서버가 수상작 알림을 만들고 설정을 확인하면 살린다.
export const notificationSettings = [
  {
    title: '팀매칭 알림',
    rows: [
      ['applicant', '새 지원자 알림', '내 모집글에 새로운 지원이 들어오면 알려드려요'],
      ['result', '지원 수락/거절 알림', '내가 지원한 팀의 수락/거절 결과를 알려드려요'],
      ['invite', '팀 초대 알림', '다른 팀에서 나를 초대하면 알려드려요'],
      ['invite_result', '초대 수락/거절 알림', '내가 본 팀 초대의 수락/거절 결과를 알려드려요'],
    ],
  },
  {
    title: '챌린지 알림',
    rows: [
      // 스캐너(ChallengeNotificationScanService)가 deadline 타입을 1회 생성한다 — D-7
      // 1회 정책(Issue #327)과 카피를 맞췄다.
      ['deadline', '마감 임박 알림', '북마크한 챌린지 마감 7일 전에 알려드려요'],
      [
        'challenge',
        '관심분야 새 챌린지 알림',
        '관심분야 새 챌린지와 북마크 챌린지 접수 시작을 알려드려요',
      ],
    ],
  },
];

// --- 마이페이지 ---

// --- 지원현황 ---

// --- 알림 ---

// --- 챌린지 상세 ---

export const contestDetail = {
  title: '2025 공공데이터 활용 창업 대회',
  org: '한국데이터산업진흥원',
  eligibility: '대학(원)생 및 일반인 누구나 참여 가능',
  period: '2025.06.01 ~ 2025.07.15',
  dday: 'D-3',
  deadline: '2025.07.15',
  prizeTotal: '3,600만원',
  teamSize: '2~5인',
  poster: '/mock/mock-poster.png',
  sections: [
    {
      title: '자격 / 대상',
      body: '대학(원)생 및 일반인 누구나 참여 가능\n팀 구성: 2~5인 (필수)',
    },
    {
      title: '일정',
      body: '접수기간: 2025.06.01 ~ 2025.07.15\n1차 심사: 2025.07.30\n최종 발표: 2025.08.20',
    },
    {
      title: '상금',
      body: '대상 1팀: 1,000만원\n최우수상 2팀: 각 500만원\n우수상 3팀: 각 300만원',
    },
  ] as { title: string; body: string }[],
};
