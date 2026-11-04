// 지원자 본인이 내용을 수정할 수 있는 상태 — 서버의 상태 가드와 동일하게 유지한다.
const EDITABLE_STATUSES = ['pending', 'submitted', 'needs_revision'];
const MAX_FILE_ANSWERS = 10;

export { EDITABLE_STATUSES, MAX_FILE_ANSWERS };
