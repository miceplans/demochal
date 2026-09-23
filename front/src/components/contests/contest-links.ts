const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 서버 챌린지(UUID)면 실제 상세로, 목데이터 카드(contest-N)면 데모 상세로 연결한다. */
export function contestHref(id: string) {
  return UUID_PATTERN.test(id) ? `/contests/${id}` : '/contests/public-data';
}
