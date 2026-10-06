// 관리자 콘솔 공용 상수·행 타입. 실제 데이터는 관리자 API(generated 클라이언트)에서 온다.

export const adminMenu: [string, string][] = [
  ['/', '대시보드'],
  ['/biz-review', '기관 심사'],
  ['/certificates', '상장 인증'],
  ['/ad-pricing', '광고 관리'],
  ['/users', '사용자 관리'],
  ['/contents', '콘텐츠 모니터링'],
  ['/reports', '신고 처리'],
  ['/emails', '메일함'],
  ['/analytics', '리포트'],
  ['/settings', '설정'],
];

export type ReportRow = {
  id: string;
  content: string;
  type: string;
  org: string;
  summary: string;
  status: '대기' | '승인' | '거부' | '알 수 없음';
  reporter: string;
  reportedAt: string;
  detail: string;
};

export type BizRow = {
  id: string;
  org: string;
  type: string;
  bizNumber: string;
  appliedAt: string;
  nts: '성공' | '실패' | '폐업/폐점' | '인식불가';
  status: '대기' | '승인' | '거부';
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  position: string;
  reports: number;
  status: '활성' | '정지';
};

export type CertificateRow = {
  id: string;
  user: string;
  award: string;
  category: string;
  status: '미인증' | '인증' | '거부';
};

export const certificateTabs = ['미인증', '인증', '거부'] as const;

// --- 광고 리포트 차트 타입 (광고비 관리 > 리포트 보기) ---
// AdReportChart의 daily prop 타입 — 실 데이터는 generated.useGetAdminAnalytics({ ad })의
// adReport.daily에서 온다 (AdminAnalyticsScreen).
export type AdDailyStat = { date: string; impressions: number; clicks: number };

export type TrafficRange = '7days' | '30days' | '1year';
