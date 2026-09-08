export type Contest = { id: string; title: string; category: string; days: number; teams: number };
export const contests: Contest[] = [
  { id: 'contest-1', title: '2025 공공데이터 활용 대회', category: 'IT/SW', days: 7, teams: 3 },
  { id: 'contest-2', title: '청년 창업 아이디어 공모전', category: '창업', days: 12, teams: 5 },
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
export const teams = [
  { id: 'team-1', name: '프로젝트팀 A', challenge: 'OO챌린지', members: '2/4명 참여중' },
  { id: 'team-2', name: '프로젝트팀 B', challenge: 'AI 해커톤', members: '3/5명 참여중' },
  { id: 'team-3', name: '프로젝트팀 C', challenge: '공공데이터 공모전', members: '1/4명 참여중' },
  { id: 'team-4', name: '프로젝트팀 D', challenge: '청년 창업 공모전', members: '2/5명 참여중' },
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
