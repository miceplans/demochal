// 서버가 eligibility를 채워주지 않아 targets로 대체한다.
// TODO: 서버가 eligibility를 내려주면 이 대체 로직을 제거한다.
export function challengeEligibility(
  challenge: {
    eligibility?: string | null;
    targets?: readonly string[] | null;
    targetOther?: string | null;
  },
  fallback = '—',
) {
  // 대상 '기타'는 직접 입력한 내용으로 바꿔 보여준다.
  const targets = challenge.targets?.map((target) =>
    target === '기타' && challenge.targetOther ? challenge.targetOther : target,
  );
  return challenge.eligibility || targets?.join(', ') || fallback;
}
