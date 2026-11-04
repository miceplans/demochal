const DEFAULT_PROFILE_IMAGE = '/assets/default-profile.png';

// 팀 상세 응답의 멤버 중 프로필 모달에 필요한 필드만 갖는 구조 타입(표의 행 그대로 넘긴다).
type MemberSummary = {
  userId?: string;
  name?: string;
  role?: string | null;
  profileImageUrl?: string | null;
};

const REGION_DISPLAY_NAMES: Record<string, string> = {
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  경기: '경기도',
  강원: '강원특별자치도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전북특별자치도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주특별자치도',
};

function formatRegion(region?: string) {
  const value = region?.trim();
  if (!value) return '지역 무관';
  return REGION_DISPLAY_NAMES[value] ?? value;
}

export type { MemberSummary };
export { DEFAULT_PROFILE_IMAGE, formatRegion };
