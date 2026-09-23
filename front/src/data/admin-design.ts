// 관리자 콘솔 목업 데이터 — Figma "세모챌 ADMIN" 디자인 기반. 실제 데이터는 관리자 API 연동 시 교체 (TODO).

export const adminUser = { name: '김관리자', role: 'Super Admin' };

export const adminMenu: [string, string][] = [
  ['/', '대시보드'],
  ['/biz-review', '기관 심사'],
  ['/certificates', '상장 인증'],
  ['/ad-pricing', '광고 관리'],
  ['/users', '사용자 관리'],
  ['/contents', '콘텐츠 모니터링'],
  ['/reports', '신고 처리'],
  ['/analytics', '리포트'],
  ['/settings', '설정'],
];

export const dashboardStats = [
  { label: '승인된 기관', value: '1,248', meta: '+12 이번 주' },
  { label: '진행 중 챌린지', value: '328', meta: '현재 공개' },
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
  {
    id: 'r-1',
    content: '2025 AI챌린지',
    type: '챌린지',
    org: '한빛협회',
    summary: '피싱 의심',
    status: '대기',
    reporter: '김*아',
    reportedAt: '2025.05.12 14:32',
    detail:
      '공고에 포함된 외부 링크가 공식 사이트와 무관한 피싱 페이지로 연결되는 것으로 보입니다.',
  },
  {
    id: 'r-2',
    content: '청년 창업 아이디어 챌린지',
    type: '챌린지',
    org: '경기대학교',
    summary: '저작권 침해',
    status: '대기',
    reporter: '이*준',
    reportedAt: '2025.05.12 13:08',
    detail: '공고 이미지와 안내 문구가 기존 챌린지의 자료를 허가 없이 사용한 것으로 보입니다.',
  },
  {
    id: 'r-3',
    content: '프로젝트팀 A 모집글',
    type: '팀 모집',
    org: '개인',
    summary: '스팸 홍보',
    status: '대기',
    reporter: '박*윤',
    reportedAt: '2025.05.12 11:46',
    detail: '팀원 모집과 무관한 상품 홍보 및 외부 채널 유입 문구가 반복적으로 게시되어 있습니다.',
  },
  {
    id: 'r-4',
    content: '2025 공공데이터 활용 대회',
    type: '챌린지',
    org: '부산문화재단',
    summary: '허위 정보',
    status: '대기',
    reporter: '최*민',
    reportedAt: '2025.05.12 10:15',
    detail: '안내된 접수 기간과 주최 기관의 공식 공고 내용이 서로 다릅니다.',
  },
  {
    id: 'r-5',
    content: '숏폼 크리에이터 챌린지 수상작',
    type: '수상작',
    org: '개인',
    summary: '표절 의심',
    status: '대기',
    reporter: '정*늘',
    reportedAt: '2025.05.11 19:22',
    detail: '다른 참여자의 수상작과 영상 구성 및 편집 방식이 매우 유사합니다.',
  },
  {
    id: 'r-6',
    content: '빅데이터 분석 경진대회',
    type: '챌린지',
    org: '한국데이터산업진흥원',
    summary: '개인정보 노출',
    status: '승인',
    reporter: '강*정',
    reportedAt: '2025.05.11 16:40',
    detail: '참가자 명단 파일에 연락처 등 개인정보가 그대로 노출되어 있습니다.',
  },
  {
    id: 'r-7',
    content: '프로젝트팀 C 모집글',
    type: '팀 모집',
    org: '개인',
    summary: '스팸 홍보',
    status: '승인',
    reporter: '오*영',
    reportedAt: '2025.05.10 12:06',
    detail: '동일한 홍보 문구가 여러 게시글에 반복 등록되어 있습니다.',
  },
  {
    id: 'r-8',
    content: 'SNS 마케팅 챌린지',
    type: '챌린지',
    org: '광주디자인진흥원',
    summary: '허위 정보',
    status: '거부',
    reporter: '윤*호',
    reportedAt: '2025.05.09 15:51',
    detail: '확인 결과 공고 정보가 주최 측의 공식 안내와 일치해 신고를 거부했습니다.',
  },
  {
    id: 'r-9',
    content: '디자인 씽킹 해커톤 모집글',
    type: '팀 모집',
    org: '개인',
    summary: '부적절 언어',
    status: '거부',
    reporter: '한*서',
    reportedAt: '2025.05.09 09:18',
    detail: '검토 결과 운영 정책 위반으로 보기 어려워 신고를 거부했습니다.',
  },
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
  {
    id: 'b-1',
    org: '부산문화재단',
    type: '비영리',
    bizNumber: '110-81-60418',
    appliedAt: '05.12',
    nts: '성공',
    status: '대기',
  },
  {
    id: 'b-2',
    org: '경기대학교',
    type: '학교',
    bizNumber: '125-82-02931',
    appliedAt: '05.12',
    nts: '성공',
    status: '승인',
  },
  {
    id: 'b-3',
    org: '한빛 협회',
    type: '협회',
    bizNumber: '302-82-10577',
    appliedAt: '05.12',
    nts: '실패',
    status: '거부',
  },
  {
    id: 'b-4',
    org: '광주디자인진흥원',
    type: '비영리',
    bizNumber: '408-82-55210',
    appliedAt: '05.11',
    nts: '폐업/폐점',
    status: '거부',
  },
  {
    id: 'b-5',
    org: '세모테크',
    type: '기업',
    bizNumber: '621-81-33892',
    appliedAt: '05.11',
    nts: '인식불가',
    status: '대기',
  },
  {
    id: 'b-6',
    org: '한국데이터산업진흥원',
    type: '비영리',
    bizNumber: '114-82-66045',
    appliedAt: '05.10',
    nts: '성공',
    status: '승인',
  },
  {
    id: 'b-7',
    org: '부산대학교',
    type: '학교',
    bizNumber: '605-82-07133',
    appliedAt: '05.10',
    nts: '성공',
    status: '승인',
  },
  {
    id: 'b-8',
    org: '스타트업협회',
    type: '협회',
    bizNumber: '214-82-99107',
    appliedAt: '05.09',
    nts: '성공',
    status: '대기',
  },
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
  {
    id: 'u-1',
    name: '김민아',
    email: 'kma@kakao.com',
    position: '프론트엔드',
    reports: 0,
    status: '활성',
  },
  {
    id: 'u-2',
    name: '이준호',
    email: 'obtuse@obtuse.kr',
    position: '백엔드',
    reports: 7,
    status: '활성',
  },
  {
    id: 'u-3',
    name: '박서윤',
    email: 'psy@gmail.com',
    position: '디자이너',
    reports: 2,
    status: '정지',
  },
  {
    id: 'u-4',
    name: '황지영',
    email: 'yuiyui6780@miceplans.com',
    position: '풀스택',
    reports: 0,
    status: '활성',
  },
  {
    id: 'u-5',
    name: '강다정',
    email: 'dajung@naver.com',
    position: '기획',
    reports: 1,
    status: '활성',
  },
  {
    id: 'u-6',
    name: '이창윤',
    email: 'changyun@kakao.com',
    position: '백엔드',
    reports: 0,
    status: '활성',
  },
  {
    id: 'u-7',
    name: '정하늘',
    email: 'haneul@gmail.com',
    position: '디자이너',
    reports: 3,
    status: '정지',
  },
  {
    id: 'u-8',
    name: '김민수',
    email: 'mskim@kakao.com',
    position: '프론트엔드',
    reports: 0,
    status: '활성',
  },
  {
    id: 'u-9',
    name: '오세영',
    email: 'syoh@obtuse.kr',
    position: '기획',
    reports: 0,
    status: '활성',
  },
];

export type CertificateRow = {
  id: string;
  user: string;
  award: string;
  category: string;
  status: '미인증' | '인증' | '거부';
};

export const certificateRows: CertificateRow[] = [
  {
    id: 'c-1',
    user: '황지영',
    award: '2025 공공데이터 활용 대회 대상',
    category: '수상 실적',
    status: '미인증',
  },
  {
    id: 'c-2',
    user: '김민아',
    award: '글로벌 스타트업 챌린지 우수상',
    category: '수상 실적',
    status: '미인증',
  },
  {
    id: 'c-3',
    user: '이준호',
    award: 'AI 이미지 인식 해커톤 3위',
    category: '출품 이력',
    status: '미인증',
  },
  {
    id: 'c-4',
    user: '박서윤',
    award: '디자인 씽킹 해커톤 파이널리스트',
    category: '출품 이력',
    status: '미인증',
  },
  {
    id: 'c-5',
    user: '강다정',
    award: '숏폼 영상 크리에이터 챌린지 대상',
    category: '수상 실적',
    status: '인증',
  },
  {
    id: 'c-6',
    user: '이창윤',
    award: '빅데이터 분석 경진대회 최우수상',
    category: '수상 실적',
    status: '인증',
  },
  {
    id: 'c-7',
    user: '정하늘',
    award: 'SNS 마케팅 아이디어 챌린지 입상',
    category: '수상 실적',
    status: '인증',
  },
  {
    id: 'c-8',
    user: '김민수',
    award: 'ESG 아이디어 챌린지 참가',
    category: '출품 이력',
    status: '거부',
  },
  {
    id: 'c-9',
    user: '오세영',
    award: '청년 창업 아이디어 챌린지 입상',
    category: '수상 실적',
    status: '거부',
  },
];

export const certificateTabs = ['미인증', '인증', '거부'] as const;

// --- 광고 리포트 차트 타입 (광고비 관리 > 리포트 보기) ---
// AdReportChart의 daily prop 타입 — 실 데이터는 generated.useGetAdminAnalytics({ ad })의
// adReport.daily에서 온다 (AdminAnalyticsScreen).
export type AdDailyStat = { date: string; impressions: number; clicks: number };

export type TrafficRange = '7days' | '30days' | '1year';
