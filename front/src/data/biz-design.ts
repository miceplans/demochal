// 기관(사업자) 콘솔 공통 데이터 — Figma "세모챌 BIZ" 디자인 기반.
// 실 API 전환(#109 등) 이후 사용처가 사라진 목업은 제거했고, 실사용 중인 항목만 남긴다.
// - orgProfile: 운영대행 페이지(`BizOperationsPage`)의 기관 연락처.
// - serviceCards/operationSteps: BIZ 랜딩(`BizLanding`)의 서비스 소개 카피.
// - won: 결제 금액을 "+/- 1,000원" 형태로 포맷하는 유틸(BizBillingPage, BizDashboardPage).

export const orgProfile = {
  name: '(주)마이스 플랜즈',
  address: '부산광역시 해운대구 센텀북대로 60 센텀IS타워 1807호',
  phone: '051-783-1170',
  email: 'mice@miceplans.com',
};
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
