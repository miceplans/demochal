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
export const chartMonths = ['7월', '8월', '9월', '10월', '11월', '12월', '1월'];
export const chartBars = [32, 45, 38, 60, 52, 74, 66];
export const paymentCard = {
  masked: '3778 **** **** 1234',
  holder: 'Eddy Cusuma',
  expiry: '12/22',
  balance: '100,000 ₩',
};
export const payments = [
  { name: '한국 마라톤 공모전 - 배너 (대)', amount: -100000, date: '2026.09.02 14:22' },
  { name: '한국 IT 공모전 - 배너 (소)', amount: -100000, date: '2026.08.28 10:05' },
  { name: '한국 IT 공모전 - 배너 (소) 환불', amount: 100000, date: '2026.08.21 09:41' },
];
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
export const applications = [
  {
    team: '빌스택스',
    applicant: '김창윤의 팀',
    status: '제출 완료',
    memo: '자료 누락 연락',
    result: '불합격',
  },
  {
    team: '크롬클로드피그마',
    applicant: '김창윤의 팀',
    status: '제출 완료',
    memo: '자료 누락 연락',
    result: '불합격',
  },
  {
    team: '터미널카카오통',
    applicant: '김창윤의 팀',
    status: '제출 완료',
    memo: '자료 누락 연락',
    result: '불합격',
  },
  {
    team: '하이웍스',
    applicant: '김창윤의 팀',
    status: '제출 완료',
    memo: '자료 누락 연락',
    result: '불합격',
  },
  {
    team: '코맷',
    applicant: '김창윤의 팀',
    status: '제출 완료',
    memo: '자료 누락 연락',
    result: '불합격',
  },
  {
    team: '한국 마라톤 공모전',
    applicant: '김창윤의 팀',
    status: '제출 완료',
    memo: '자료 누락 연락',
    result: '불합격',
  },
  {
    team: '한국 IT 공모전',
    applicant: '강다정의 팀',
    status: '제출 완료',
    memo: '자료 누락 연락',
    result: '불합격',
  },
];
export const dailyReport = [
  { date: '2026-08-25', exposure: 100000, clicks: 30000, ctr: '3%' },
  { date: '2026-08-26', exposure: 100000, clicks: 100000, ctr: '2%' },
  { date: '2026-08-27', exposure: 100000, clicks: 100000, ctr: '5%' },
];
export const hourlyReport = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}시~${i + 1}시`,
  exposure: 100000,
  clicks: 100000,
  ctr: '3%',
}));
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
export const flowSteps = ['공고 등록', '검수', '게시', '홍보', '성과 확인'];
export const won = (n: number) => `${n > 0 ? '+ ' : '- '}${Math.abs(n).toLocaleString()}원`;
