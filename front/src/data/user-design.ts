// 유저 페이지 목업 데이터 — Figma "세모챌" 디자인 기반. 실제 데이터는 유저 API 연동 시 교체 (TODO).

export type Contest = { id: string; title: string; category: string; days: number; teams: number };
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
export type Team = {
  id: string;
  name: string;
  challenge: string;
  members: string;
  filledRoles: string[];
  recruitingRoles: string[];
};
export const teams: Team[] = [
  {
    id: 'team-1',
    name: '프로젝트팀 A',
    challenge: 'OO챌린지',
    members: '2/4명 참여중',
    filledRoles: ['기획', '프론트엔드'],
    recruitingRoles: ['백엔드', '디자이너'],
  },
  {
    id: 'team-2',
    name: '프로젝트팀 B',
    challenge: 'AI 해커톤',
    members: '3/5명 참여중',
    filledRoles: ['기획', '프론트엔드'],
    recruitingRoles: ['백엔드', '디자이너'],
  },
  {
    id: 'team-3',
    name: '프로젝트팀 C',
    challenge: '공공데이터 챌린지',
    members: '1/4명 참여중',
    filledRoles: ['기획', '디자이너'],
    recruitingRoles: ['백엔드', '프론트엔드'],
  },
  {
    id: 'team-4',
    name: '프로젝트팀 D',
    challenge: '청년 창업 챌린지',
    members: '2/5명 참여중',
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
export const roles = ['프론트엔드', '백엔드', '디자이너', '기획자', '풀스택'];
export const stacks = ['React', 'TypeScript', 'Next.js', 'Node.js', 'Figma', 'Python'];
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
  { key: 'roles' as const, title: '선호 역할', options: roles },
  {
    key: 'audience' as const,
    title: '참가 대상',
    options: ['대학생', '일반인', '직장인', '청소년'],
  },
];
export const notificationSettings = [
  {
    title: '팀매칭 알림',
    rows: [
      ['applicant', '새 지원자 알림', '내 모집글에 새로운 지원이 들어오면 알려드려요'],
      ['result', '지원 수락/거절 알림', '내가 지원한 팀의 수락/거절 결과를 알려드려요'],
      ['invite', '팀 초대 알림', '다른 팀에서 나를 초대하면 알려드려요'],
    ],
  },
  {
    title: '챌린지 알림',
    rows: [
      ['deadline', '마감 임박 알림', '북마크한 챌린지 마감 D-7, D-3, D-1에 알려드려요'],
      ['challenge', '관심분야 새 챌린지 알림', '관심분야에 새 챌린지가 등록되면 알려드려요'],
      ['award', '새 수상작 알림', '관심분야에 새 수상작이 등록되면 알려드려요'],
    ],
  },
];

// --- 프로필 ---

export const profileUser = {
  name: '황지영',
  role: '풀스택 개발자',
  region: '서울',
  intro: '데이터 시각화와 프로덕트 개발을 좋아하는 풀스택 개발자예요.',
  links: [
    { label: 'github.com/juhyun-kim', url: 'https://github.com/juhyun-kim', icon: 'imgLink1Icon' },
    { label: 'portfolio.juhyun.dev', url: 'https://portfolio.juhyun.dev', icon: 'imgLink2Icon' },
    {
      label: 'notion.so/juhyun-resume',
      url: 'https://notion.so/juhyun-resume',
      icon: 'imgLink3Icon',
    },
  ],
};

export type AwardHistory = { title: string; award: string; detail: string; href?: string };

export const awardHistory: AwardHistory[] = [
  {
    title: '2025 공공데이터 활용 챌린지',
    award: '대상',
    detail: '프론트엔드 · 3인 팀',
    href: '/contests/public-data',
  },
  { title: '2024 스타트업 해커톤', award: '우수상', detail: '풀스택 · 4인 팀' },
  { title: '2024 ESG 아이디어 챌린지', award: '출품', detail: '기획 · 5인 팀' },
];

// --- 마이페이지 ---

export type ParticipatingTeam = {
  id: string;
  challenge: string;
  description: string;
  filledRoles: string[];
  recruitingRoles: string[];
  dday: string;
  deadline: string;
  href: string;
};

export const participatingTeams: ParticipatingTeam[] = [
  {
    id: 'part-1',
    challenge: 'OO챌린지',
    description: '데이터 시각화로 도시 문제 해결',
    filledRoles: ['디자이너', '백엔드'],
    recruitingRoles: ['기획', '프론트엔드'],
    dday: 'D-14',
    deadline: '마감 7월 10일',
    href: '/my/teams/public-data',
  },
  {
    id: 'part-2',
    challenge: 'AI 해커톤',
    description: '생성형 AI 기반 학습 도우미 제작',
    filledRoles: ['프론트엔드', '기획'],
    recruitingRoles: ['백엔드', '디자이너'],
    dday: 'D-9',
    deadline: '마감 7월 5일',
    href: '/my/teams/public-data',
  },
];

// --- 지원현황 ---

export type ContestApplication = {
  id: string;
  contest: string;
  org: string;
  result: '예선 통과' | '심사중' | '불합격';
  href: string;
};

// API 연동 전 화면에서 사용하는 내 챌린지 신청 목업 데이터.
// `Application` 도메인 모델과 같은 필드만 유지해 이후 API 전환도 단순하게 한다.
export const myApplications = [
  {
    id: 'my-application-1',
    challengeId: 'ch-1',
    userId: 'mock-user-1',
    status: 'approved' as const,
    createdAt: '2025-05-28T09:00:00.000Z',
  },
  {
    id: 'my-application-2',
    challengeId: 'ch-2',
    userId: 'mock-user-1',
    status: 'pending' as const,
    createdAt: '2025-07-18T09:00:00.000Z',
  },
  {
    id: 'my-application-3',
    challengeId: 'ch-4',
    userId: 'mock-user-1',
    status: 'rejected' as const,
    createdAt: '2025-04-20T09:00:00.000Z',
  },
];

export const contestApplications: ContestApplication[] = [
  {
    id: 'ca-1',
    contest: '한국 마라톤 챌린지',
    org: '한국 마라톤 협회',
    result: '예선 통과',
    href: '/contests/public-data',
  },
  {
    id: 'ca-2',
    contest: '2025 공공데이터 활용 대회',
    org: '한국데이터산업진흥원',
    result: '심사중',
    href: '/contests/public-data',
  },
  {
    id: 'ca-3',
    contest: '빅데이터 분석 경진대회',
    org: '한국데이터산업진흥원',
    result: '심사중',
    href: '/contests/public-data',
  },
  {
    id: 'ca-4',
    contest: '글로벌 스타트업 챌린지',
    org: '중소벤처기업진흥공단',
    result: '불합격',
    href: '/contests/public-data',
  },
];

export type TeamApplication = {
  id: string;
  contest: string;
  team: string;
  result: '확정' | '검토중' | '불합격';
};

export const teamApplications: TeamApplication[] = [
  { id: 'ta-1', contest: '한국 마라톤 챌린지', team: '김창윤의 팀', result: '불합격' },
  { id: 'ta-2', contest: '한국 IT 챌린지', team: '강다정의 팀', result: '확정' },
  { id: 'ta-3', contest: 'AI 이미지 인식 해커톤', team: '프로젝트팀 B', result: '검토중' },
];

export type TeamApplicant = {
  id: string;
  name: string;
  badges: string[];
  href: string;
};

export const teamApplicants: TeamApplicant[] = [
  {
    id: 'ap-1',
    name: '이창윤',
    badges: ['깃허브 인증', '출품이력'],
    href: '/profile',
  },
  { id: 'ap-2', name: '황지영', badges: ['포트폴리오', '출품이력'], href: '/profile' },
];

// --- 알림 ---

export type NotificationItem = {
  id: string;
  category: '팀매칭' | '마감' | '공고';
  title: string;
  body: string;
};

export const notificationItems: NotificationItem[] = [
  {
    id: 'n-1',
    category: '팀매칭',
    title: '공공데이터 챌린지 팀 · 김민수님이 지원',
    body: '2분 전',
  },
  {
    id: 'n-2',
    category: '팀매칭',
    title: '디자이너 자리 지원이 수락되었어요',
    body: '스타트업 해커톤 팀 · 15분 전',
  },
  {
    id: 'n-3',
    category: '마감',
    title: '북마크한 챌린지 마감 D-7',
    body: '7월 3일 마감',
  },
  {
    id: 'n-4',
    category: '공고',
    title: '관심분야 새 챌린지가 등록되었어요',
    body: 'AI/데이터 분야 · 1시간 전',
  },
  {
    id: 'n-5',
    category: '공고',
    title: '관심분야 새 수상작이 등록되었어요',
    body: '디자인 분야 · 3시간 전',
  },
];

export const notificationTabs = ['전체', '팀매칭', '마감', '공고'] as const;

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
