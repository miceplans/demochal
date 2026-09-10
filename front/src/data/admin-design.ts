// 관리자 콘솔 목업 데이터 — Figma "세모챌 ADMIN" 디자인 기반. 실제 데이터는 관리자 API 연동 시 교체 (TODO).

export const adminUser = { name: '김관리자', role: 'Super Admin' };

export const adminMenu: [string, string][] = [
  ['/admin', '대시보드'],
  ['/admin/biz-review', '기관 심사'],
  ['/admin/certificates', '상장 인증'],
  ['/admin/ad-pricing', '광고 관리'],
  ['/admin/users', '사용자 관리'],
  ['/admin/contents', '콘텐츠 모니터링'],
  ['/admin/reports', '신고 처리'],
  ['/admin/analytics', '리포트'],
  ['/admin/settings', '설정'],
];

export const dashboardStats = [
  { label: '승인된 기관', value: '1,248', meta: '+12 이번 주' },
  { label: '진행 중 공모전', value: '328', meta: '현재 공개' },
  { label: '누적 제출물', value: '84,210', meta: '전월 대비 +8%' },
  { label: '신규 가입자', value: '2,941', meta: '미니 추이 상승' },
];

export type ReportRow = {
  id: string;
  content: string;
  type: string;
  org: string;
  summary: string;
  status: '대기' | '승인' | '거부';
  reporter: string;
  reportedAt: string;
  detail: string;
};

export const reportRows: ReportRow[] = [
  { id: 'r-1', content: '2025 AI공모전', type: '공모전', org: '한빛협회', summary: '피싱 의심', status: '대기', reporter: '김*아', reportedAt: '2025.05.12 14:32', detail: '공고에 포함된 외부 링크가 공식 사이트와 무관한 피싱 페이지로 연결되는 것으로 보입니다.' },
  { id: 'r-2', content: '청년 창업 아이디어 공모전', type: '공모전', org: '경기대학교', summary: '저작권 침해', status: '대기', reporter: '이*준', reportedAt: '2025.05.12 13:08', detail: '공고 이미지와 안내 문구가 기존 공모전의 자료를 허가 없이 사용한 것으로 보입니다.' },
  { id: 'r-3', content: '프로젝트팀 A 모집글', type: '팀 모집', org: '개인', summary: '스팸 홍보', status: '대기', reporter: '박*윤', reportedAt: '2025.05.12 11:46', detail: '팀원 모집과 무관한 상품 홍보 및 외부 채널 유입 문구가 반복적으로 게시되어 있습니다.' },
  { id: 'r-4', content: '2025 공공데이터 활용 대회', type: '공모전', org: '부산문화재단', summary: '허위 정보', status: '대기', reporter: '최*민', reportedAt: '2025.05.12 10:15', detail: '안내된 접수 기간과 주최 기관의 공식 공고 내용이 서로 다릅니다.' },
  { id: 'r-5', content: '숏폼 크리에이터 챌린지 수상작', type: '수상작', org: '개인', summary: '표절 의심', status: '대기', reporter: '정*늘', reportedAt: '2025.05.11 19:22', detail: '다른 참여자의 수상작과 영상 구성 및 편집 방식이 매우 유사합니다.' },
  { id: 'r-6', content: '빅데이터 분석 경진대회', type: '공모전', org: '한국데이터산업진흥원', summary: '개인정보 노출', status: '승인', reporter: '강*정', reportedAt: '2025.05.11 16:40', detail: '참가자 명단 파일에 연락처 등 개인정보가 그대로 노출되어 있습니다.' },
  { id: 'r-7', content: '프로젝트팀 C 모집글', type: '팀 모집', org: '개인', summary: '스팸 홍보', status: '승인', reporter: '오*영', reportedAt: '2025.05.10 12:06', detail: '동일한 홍보 문구가 여러 게시글에 반복 등록되어 있습니다.' },
  { id: 'r-8', content: 'SNS 마케팅 챌린지', type: '공모전', org: '광주디자인진흥원', summary: '허위 정보', status: '거부', reporter: '윤*호', reportedAt: '2025.05.09 15:51', detail: '확인 결과 공고 정보가 주최 측의 공식 안내와 일치해 신고를 거부했습니다.' },
  { id: 'r-9', content: '디자인 씽킹 해커톤 모집글', type: '팀 모집', org: '개인', summary: '부적절 언어', status: '거부', reporter: '한*서', reportedAt: '2025.05.09 09:18', detail: '검토 결과 운영 정책 위반으로 보기 어려워 신고를 거부했습니다.' },
];

export const bizStats = [
  { label: '전체 신청', value: '432', meta: '누적', dot: '#0877FF' },
  { label: '승인', value: '328', meta: '누적', dot: '#22C55E' },
  { label: '거부', value: '80', meta: '누적', dot: '#FF4D00' },
  { label: '대기', value: '24', meta: '검토 필요', dot: '#F59E0B' },
];

export type BizRow = {
  id: string;
  org: string;
  type: string;
  bizNumber: string;
  appliedAt: string;
  nts: '성공' | '실패' | '폐업/폐점' | '인식불가';
  status: '대기' | '승인' | '거부';
};

export const bizRows: BizRow[] = [
  { id: 'b-1', org: '부산문화재단', type: '비영리', bizNumber: '110-81-60418', appliedAt: '05.12', nts: '성공', status: '대기' },
  { id: 'b-2', org: '경기대학교', type: '학교', bizNumber: '125-82-02931', appliedAt: '05.12', nts: '성공', status: '승인' },
  { id: 'b-3', org: '한빛 협회', type: '협회', bizNumber: '302-82-10577', appliedAt: '05.12', nts: '실패', status: '거부' },
  { id: 'b-4', org: '광주디자인진흥원', type: '비영리', bizNumber: '408-82-55210', appliedAt: '05.11', nts: '폐업/폐점', status: '거부' },
  { id: 'b-5', org: '세모테크', type: '기업', bizNumber: '621-81-33892', appliedAt: '05.11', nts: '인식불가', status: '대기' },
  { id: 'b-6', org: '한국데이터산업진흥원', type: '비영리', bizNumber: '114-82-66045', appliedAt: '05.10', nts: '성공', status: '승인' },
  { id: 'b-7', org: '부산대학교', type: '학교', bizNumber: '605-82-07133', appliedAt: '05.10', nts: '성공', status: '승인' },
  { id: 'b-8', org: '스타트업협회', type: '협회', bizNumber: '214-82-99107', appliedAt: '05.09', nts: '성공', status: '대기' },
];

export type UserRow = {
  id: string;
  name: string;
  email: string;
  position: string;
  reports: number;
  status: '활성' | '정지';
};

export const userRows: UserRow[] = [
  { id: 'u-1', name: '김민아', email: 'kma@kakao.com', position: '프론트엔드', reports: 0, status: '활성' },
  { id: 'u-2', name: '이준호', email: 'obtuse@obtuse.kr', position: '백엔드', reports: 7, status: '활성' },
  { id: 'u-3', name: '박서윤', email: 'psy@gmail.com', position: '디자이너', reports: 2, status: '정지' },
  { id: 'u-4', name: '황지영', email: 'yuiyui6780@miceplans.com', position: '풀스택', reports: 0, status: '활성' },
  { id: 'u-5', name: '강다정', email: 'dajung@naver.com', position: '기획', reports: 1, status: '활성' },
  { id: 'u-6', name: '이창윤', email: 'changyun@kakao.com', position: '백엔드', reports: 0, status: '활성' },
  { id: 'u-7', name: '정하늘', email: 'haneul@gmail.com', position: '디자이너', reports: 3, status: '정지' },
  { id: 'u-8', name: '김민수', email: 'mskim@kakao.com', position: '프론트엔드', reports: 0, status: '활성' },
  { id: 'u-9', name: '오세영', email: 'syoh@obtuse.kr', position: '기획', reports: 0, status: '활성' },
];

export type CertificateRow = {
  id: string;
  user: string;
  award: string;
  category: string;
  status: '미인증' | '인증' | '거부';
};

export const certificateRows: CertificateRow[] = [
  { id: 'c-1', user: '황지영', award: '2025 공공데이터 활용 대회 대상', category: '수상 실적', status: '미인증' },
  { id: 'c-2', user: '김민아', award: '글로벌 스타트업 챌린지 우수상', category: '수상 실적', status: '미인증' },
  { id: 'c-3', user: '이준호', award: 'AI 이미지 인식 해커톤 3위', category: '출품 이력', status: '미인증' },
  { id: 'c-4', user: '박서윤', award: '디자인 씽킹 해커톤 파이널리스트', category: '출품 이력', status: '미인증' },
  { id: 'c-5', user: '강다정', award: '숏폼 영상 크리에이터 챌린지 대상', category: '수상 실적', status: '인증' },
  { id: 'c-6', user: '이창윤', award: '빅데이터 분석 경진대회 최우수상', category: '수상 실적', status: '인증' },
  { id: 'c-7', user: '정하늘', award: 'SNS 마케팅 아이디어 챌린지 입상', category: '수상 실적', status: '인증' },
  { id: 'c-8', user: '김민수', award: 'ESG 아이디어 챌린지 참가', category: '출품 이력', status: '거부' },
  { id: 'c-9', user: '오세영', award: '청년 창업 아이디어 공모전 입상', category: '수상 실적', status: '거부' },
];

export const certificateTabs = ['미인증', '인증', '거부'] as const;

export type AdminTeamCard = {
  id: string;
  name: string;
  challenge: string;
  members: string;
  roles: string[];
  otherRoles: string[];
  unread: boolean;
};

export const adminTeams: AdminTeamCard[] = [
  { id: 't-1', name: '프로젝트팀 A', challenge: 'OO챌린지', members: '2/4명 참여중', roles: ['기획', '프론트엔드'], otherRoles: ['백엔드', '디자이너'], unread: true },
  { id: 't-2', name: '프로젝트팀 B', challenge: 'AI 해커톤', members: '3/5명 참여중', roles: ['기획', '프론트엔드'], otherRoles: ['백엔드', '디자이너'], unread: true },
  { id: 't-3', name: '프로젝트팀 C', challenge: '공공데이터 공모전', members: '1/4명 참여중', roles: ['기획', '디자인'], otherRoles: ['백엔드', '프론트엔드'], unread: true },
  { id: 't-4', name: '프로젝트팀 D', challenge: '청년 창업 공모전', members: '2/5명 참여중', roles: ['기획', '백엔드'], otherRoles: ['프론트엔드', '디자이너'], unread: false },
  { id: 't-5', name: '빌스택스', challenge: '숏폼 영상 챌린지', members: '3/4명 참여중', roles: ['기획', '디자인'], otherRoles: ['백엔드'], unread: false },
];

export type AdminContestCard = {
  id: string;
  title: string;
  category: string;
  dday: string;
  teams: string;
  unread: boolean;
};

export const adminContests: AdminContestCard[] = [
  { id: 'cc-1', title: '2025 공공데이터 활용 대회', category: 'IT/SW', dday: 'D-7', teams: '팀 모집 3건', unread: true },
  { id: 'cc-2', title: 'AI 이미지 인식 해커톤', category: 'IT/SW', dday: 'D-9', teams: '팀 모집 4건', unread: true },
  { id: 'cc-3', title: '빅데이터 분석 경진대회', category: 'IT/SW', dday: 'D-7', teams: '팀 모집 3건', unread: false },
  { id: 'cc-4', title: '글로벌 스타트업 챌린지', category: '창업', dday: 'D-20', teams: '팀 모집 2건', unread: false },
  { id: 'cc-5', title: '디자인 씽킹 해커톤', category: '디자인', dday: 'D-3', teams: '팀 모집 1건', unread: false },
];

export const analyticsStats = [
  { label: '신규 가입자', value: '12,842', meta: '월간', dot: '#0877FF' },
  { label: '신규 공모전', value: '328', meta: '월간', dot: '#0877FF' },
  { label: '플랫폼 수익', value: '₩42.8M', meta: '월간', dot: '#0877FF' },
];

// --- 대시보드 차트 ---

export const adRatio = { value: '100,000 ₩', ratio: 0.72 };

// --- 광고비 책정 ---

export const adPricing = { dailyPrice: 10000 };

export type TrafficRange = '7days' | '30days' | '1year';

export const trafficData: Record<TrafficRange, { labels: string[]; primary: number[]; secondary: number[] }> = {
  '7days': {
    labels: ['1일', '2일', '3일', '4일', '5일', '6일', '7일'],
    primary: [32, 45, 38, 60, 52, 75, 68],
    secondary: [20, 28, 24, 35, 30, 42, 38],
  },
  '30days': {
    labels: ['5일', '10일', '15일', '20일', '25일', '30일'],
    primary: [120, 165, 148, 210, 188, 240],
    secondary: [78, 102, 95, 132, 118, 150],
  },
  '1year': {
    labels: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
    primary: [210, 260, 230, 310, 290, 360, 330, 410, 380, 450, 470, 520],
    secondary: [120, 150, 140, 190, 170, 220, 200, 260, 240, 300, 310, 350],
  },
};

export const activityChart = {
  months: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'],
  general: [3.2, 4.1, 3.8, 5.2, 6.4, 7.8],
  corp: [1.8, 2.4, 2.2, 3.1, 3.6, 4.4],
  yMax: 10,
  tooltipIndex: 3,
  tooltipValue: '1000',
};

// --- 관리자 설정 ---

export const adminSettingsProfile = [
  ['이름', '김관리자'],
  ['역할', 'Super Admin'],
  ['이메일', 'admin@semochal.com'],
  ['2단계 인증', '사용중'],
] as const;

export const adminSettingsGroups = [
  {
    title: '서비스 설정',
    rows: [
      ['bizAutoApprove', '기관 가입 자동 승인', 'NTS 인증 성공 시에도 심사 없이 자동 승인합니다'],
      ['contestAutoPublish', '공고 자동 게시', '검수 대기 없이 등록 즉시 공개합니다'],
      ['maintenanceMode', '점검 모드', '서비스 점검 중 일반 사용자의 접속을 제한합니다'],
    ],
  },
  {
    title: '알림 설정',
    rows: [
      ['reportAlert', '신고 접수 알림', '새 신고가 접수되면 즉시 알려드려요'],
      ['bizAlert', '기관 심사 요청 알림', '새 기관 심사 신청이 들어오면 알려드려요'],
      ['certificateAlert', '상장 인증 요청 알림', '새 상장 인증 요청이 들어오면 알려드려요'],
    ],
  },
] as const;

export const adminSettingsDefaults: Record<string, boolean> = {
  bizAutoApprove: false,
  contestAutoPublish: true,
  maintenanceMode: false,
  reportAlert: true,
  bizAlert: true,
  certificateAlert: false,
};
