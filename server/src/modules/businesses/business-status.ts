// businesses.verification_status: 가입 시 verified로 자동 승인되고, 관리자가 rejected로 차단/복구할 수 있다.
// ('pending'은 서류 심사 시절의 레거시 값 — 0040 마이그레이션으로 모두 verified가 됐다.)
export function verificationStatusPresentation(status: string) {
  if (status === 'verified') return { displayStatus: '승인', detailStatus: '승인' };
  if (status === 'rejected') return { displayStatus: '반려', detailStatus: '실패' };
  return { displayStatus: '가승인', detailStatus: '인증 대기' };
}
