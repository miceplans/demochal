// 기관(사업자) 콘솔 목업 데이터 — Figma "세모챌 BIZ" 디자인 기반. 실제 데이터는 기관 API 연동 시 교체 (TODO).

export const admin = {
  name: '황지영',
  company: '(주)마이스플랜즈',
  email: 'yuiyui6780@miceplans.com',
  phone: '051-783-1170',
  id: 'yuiyui6780',
};
export const orgProfile = {
  name: '국가 정보원',
  address: '부산광역시 해운대구 센텀북대로 60 센텀IS타워 1807호',
  phone: '051-783-1170',
  email: 'mice@miceplans.com',
};
export const recentPosting = {
  id: 'ch-1',
  title: '2025 공공데이터 활용 창업 대회',
  org: '한국데이터산업진흥원',
  eligibility: '대학(원)생 및 일반인 누구나 참여 가능',
  period: '2025.06.01 ~ 2025.07.15',
};
export const postingStats = {
  clicks: { value: '8,341번', delta: '+8.2% 전주 대비' },
  bookmarks: { value: '2,156개', delta: '+5.1% 전주 대비' },
  exposure: { value: '124,582 조회수', delta: '+12.5% 전주 대비' },
};
export const applicantDistribution = [
  { label: '고등학생', value: 63 },
  { label: '대학생', value: 25 },
];
export const myPostingCards = [
  { id: 'ch-1', title: '2025 공공데이터 활용 대회', category: 'IT/SW', dday: 'D-7', teamCount: 3, closed: true },
  { id: 'ch-3', title: '디자인 씽킹 해커톤', category: '디자인', dday: 'D-3', teamCount: 5, closed: false },
];
export const chartMonths = ['7월', '8월', '9월', '10월', '11월', '12월', '1월'];
export const chartBars = [32, 45, 38, 60, 52, 74, 66];
export const paymentCard = {
  masked: '3778 **** **** 1234',
  holder: 'Eddy Cusuma',
  expiry: '12/22',
};
export const payments = [
  { name: '한국 마라톤 공모전 - 배너 (대)', amount: -100000, date: '2026.09.02 14:22' },
  { name: '한국 IT 공모전 - 배너 (소)', amount: -100000, date: '2026.08.28 10:05' },
  { name: '한국 IT 공모전 - 배너 (소) 환불', amount: 100000, date: '2026.08.21 09:41' },
];
export const paymentHistory = [
  { name: '2025 스타트업 해커톤 - 메인 배너 (대)', amount: -100000, date: '2026.09.08 16:40' },
  { name: '충전 - 신용카드', amount: 300000, date: '2026.09.05 11:12' },
  { name: '한국 마라톤 공모전 - 배너 (대)', amount: -100000, date: '2026.09.02 14:22' },
  { name: '디자인 씽킹 해커톤 - 팀원모집중 배너', amount: -40000, date: '2026.08.30 09:30' },
  { name: '한국 IT 공모전 - 배너 (소)', amount: -60000, date: '2026.08.28 10:05' },
  { name: '한국 IT 공모전 - 배너 (소) 환불', amount: 60000, date: '2026.08.21 09:41' },
  { name: '충전 - 신용카드', amount: 200000, date: '2026.08.15 15:03' },
];
export const paymentTotal = paymentHistory.reduce((sum, p) => sum + p.amount, 0);
export const activeAds = [
  { title: '2025 공공데이터 활용 챌린지', status: '진행중', exposure: '45,231', bookmarks: '892' },
  { title: '2025 스타트업 해커톤', status: '준비중', exposure: '—', bookmarks: '—' },
];
export const myAds = [
  { title: '한국 마라톤 공모전', price: '100,000원', status: '만료' },
  { title: '한국 IT 공모전', price: '100,000원', status: '진행중' },
];
export const adProducts = [
  {
    name: '메인 배너 (대)',
    desc: '홈 상단 대형 배너, 마감 임박 공고 우선 노출',
    price: 100000,
    period: '7일',
  },
  {
    name: '메인 배너 (소)',
    desc: '탐색 페이지 상단 배너, 카테고리 타깃 노출',
    price: 60000,
    period: '7일',
  },
  {
    name: '팀원모집중 배너',
    desc: '팀 탐색 페이지 배너, 팀 빌딩 성향 사용자 도달',
    price: 40000,
    period: '14일',
  },
];
export type BizApplication = {
  id: string;
  team: string;
  applicant: string;
  status: '제출 완료' | '검토중' | '보완 요청';
  memo: string;
  result: '미정' | '합격' | '불합격';
};

export const applications: BizApplication[] = [
  { id: 'ba-1', team: '빌스택스', applicant: '김창윤의 팀', status: '제출 완료', memo: '자료 누락 연락', result: '불합격' },
  { id: 'ba-2', team: '크롬클로드피그마', applicant: '강다정의 팀', status: '검토중', memo: '1차 서류 통과', result: '미정' },
  { id: 'ba-3', team: '터미널카카오통', applicant: '이승민의 팀', status: '제출 완료', memo: '팀 구성 확인 필요', result: '미정' },
  { id: 'ba-4', team: '하이웍스', applicant: '박서윤의 팀', status: '보완 요청', memo: '포트폴리오 재제출 요청', result: '미정' },
  { id: 'ba-5', team: '코맷', applicant: '정하늘의 팀', status: '제출 완료', memo: '발표 영상 우수', result: '합격' },
  { id: 'ba-6', team: '한국 마라톤 공모전', applicant: '김창윤의 팀', status: '검토중', memo: '자료 누락 연락', result: '불합격' },
  { id: 'ba-7', team: '한국 IT 공모전', applicant: '강다정의 팀', status: '제출 완료', memo: '', result: '합격' },
];
export const dailyReport = [
  { date: '2026-08-25', exposure: 38200, clicks: 1146, ctr: '3.0%' },
  { date: '2026-08-26', exposure: 41550, clicks: 1662, ctr: '4.0%' },
  { date: '2026-08-27', exposure: 52680, clicks: 2107, ctr: '4.0%' },
];
export const hourlyReport = [
  { hour: '0시~1시', exposure: 1200, clicks: 24, ctr: '2.0%' },
  { hour: '1시~2시', exposure: 800, clicks: 16, ctr: '2.0%' },
  { hour: '2시~3시', exposure: 600, clicks: 9, ctr: '1.5%' },
  { hour: '3시~4시', exposure: 400, clicks: 6, ctr: '1.5%' },
  { hour: '4시~5시', exposure: 500, clicks: 8, ctr: '1.6%' },
  { hour: '5시~6시', exposure: 900, clicks: 18, ctr: '2.0%' },
  { hour: '6시~7시', exposure: 1800, clicks: 54, ctr: '3.0%' },
  { hour: '7시~8시', exposure: 3200, clicks: 112, ctr: '3.5%' },
  { hour: '8시~9시', exposure: 4800, clicks: 192, ctr: '4.0%' },
  { hour: '9시~10시', exposure: 5600, clicks: 246, ctr: '4.4%' },
  { hour: '10시~11시', exposure: 6100, clicks: 275, ctr: '4.5%' },
  { hour: '11시~12시', exposure: 5900, clicks: 266, ctr: '4.5%' },
  { hour: '12시~13시', exposure: 6400, clicks: 320, ctr: '5.0%' },
  { hour: '13시~14시', exposure: 6200, clicks: 298, ctr: '4.8%' },
  { hour: '14시~15시', exposure: 5800, clicks: 261, ctr: '4.5%' },
  { hour: '15시~16시', exposure: 5400, clicks: 227, ctr: '4.2%' },
  { hour: '16시~17시', exposure: 5100, clicks: 204, ctr: '4.0%' },
  { hour: '17시~18시', exposure: 4900, clicks: 186, ctr: '3.8%' },
  { hour: '18시~19시', exposure: 4500, clicks: 158, ctr: '3.5%' },
  { hour: '19시~20시', exposure: 4200, clicks: 147, ctr: '3.5%' },
  { hour: '20시~21시', exposure: 3800, clicks: 133, ctr: '3.5%' },
  { hour: '21시~22시', exposure: 3200, clicks: 109, ctr: '3.4%' },
  { hour: '22시~23시', exposure: 2400, clicks: 72, ctr: '3.0%' },
  { hour: '23시~24시', exposure: 1600, clicks: 40, ctr: '2.5%' },
];
export const serviceCards = [
  { title: '공고 등록', desc: '챌린지, 대외활동, 해커톤, 기관 이벤트를 직접 등록합니다.' },
  { title: '추천 노출', desc: '마감 시점과 타깃에 맞는 유료 홍보상품을 선택합니다.' },
  { title: '성과 리포트', desc: '조회, 저장, 신청 클릭 중심으로 모집 반응을 확인합니다.' },
  { title: '운영대행', desc: '기획, 접수, 심사, 결과 보고까지 필요한 범위를 문의합니다.' },
];
export const operationSteps = [
  '챌린지 기획',
  '모집 홍보',
  '참가자 접수',
  '심사 운영',
  '시상식 운영',
  '결과 보고',
];
export const won = (n: number) => `${n > 0 ? '+ ' : '- '}${Math.abs(n).toLocaleString()}원`;

// --- 내 챌린지 관리 (공고 관리 테이블 폴백 목업) ---
// @semochal/api-client의 Challenge 스키마와 동일한 형태.
export const myChallenges = [
  {
    id: 'ch-1',
    businessId: 'biz-1',
    title: '2025 공공데이터 활용 창업 대회',
    description: '공공데이터를 활용한 창업 아이디어를 발굴하는 대회입니다.',
    price: 0,
    capacity: 100,
    startDate: '2025-06-01T00:00:00.000Z',
    endDate: '2025-07-15T23:59:59.000Z',
    status: 'published' as const,
    createdAt: '2025-05-20T09:00:00.000Z',
  },
  {
    id: 'ch-2',
    businessId: 'biz-1',
    title: 'AI 이미지 인식 해커톤',
    description: '48시간 동안 AI 이미지 인식 솔루션을 만드는 해커톤입니다.',
    price: 50000,
    capacity: 40,
    startDate: '2025-08-01T00:00:00.000Z',
    endDate: '2025-08-03T23:59:59.000Z',
    status: 'published' as const,
    createdAt: '2025-07-01T10:30:00.000Z',
  },
  {
    id: 'ch-3',
    businessId: 'biz-1',
    title: '디자인 씽킹 해커톤',
    description: '디자인 씽킹 프로세스로 지역 문제를 해결하는 해커톤입니다.',
    price: 30000,
    capacity: 60,
    startDate: '2025-09-01T00:00:00.000Z',
    endDate: '2025-09-07T23:59:59.000Z',
    status: 'draft' as const,
    createdAt: '2025-08-20T14:00:00.000Z',
  },
  {
    id: 'ch-4',
    businessId: 'biz-1',
    title: '숏폼 영상 크리에이터 챌린지',
    description: '1분 숏폼 영상으로 브랜드 스토리를 담는 챌린지입니다.',
    price: 0,
    capacity: 200,
    startDate: '2025-05-01T00:00:00.000Z',
    endDate: '2025-05-31T23:59:59.000Z',
    status: 'closed' as const,
    createdAt: '2025-04-10T11:20:00.000Z',
  },
];
