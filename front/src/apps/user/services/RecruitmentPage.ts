import { roles } from '@/data/user-design';

// 모집글 역할은 '기타' 대신 '직접 입력'으로 자유롭게 적게 한다(공용 roles는 필터 등에서 그대로 쓴다).
const CUSTOM_ROLE = '직접 입력';
const PRESET_ROLES = roles.filter((x) => x !== '기타');
const ROLE_OPTIONS = [...PRESET_ROLES, CUSTOM_ROLE].map((x) => ({ value: x, label: x }));
const CUSTOM_ROLE_MAX = 20;
// 팀명은 DB 컬럼(200)보다 짧게 제한해 카드·목록 표시가 깨지지 않게 한다.
const TEAM_TITLE_MAX = 30;
const normalizeRole = (value: string) => value.trim().replace(/\s+/g, ' ');

export { CUSTOM_ROLE, CUSTOM_ROLE_MAX, normalizeRole, PRESET_ROLES, ROLE_OPTIONS, TEAM_TITLE_MAX };
