import type { ProfileUserData } from '../components/profile/ProfileCards';
import { isGithubUrl, isSafeLinkUrl } from '../components/profile/link-model';

const DEFAULT_PROFILE_IMAGE = '/assets/default-profile.png';

// 사람 카드와 같은 규칙: 링크·수상 이력에서 인증 배지를 도출하고, 저장된 badges와 합쳐 중복을 없앤다.
function verificationBadges(user: ProfileUserData) {
  const links = (user.externalLinks ?? []).filter((link) => isSafeLinkUrl(link.url));
  const derived: { label: string; icon: string; tone: 'gray' | 'blue' | 'green' }[] = [];
  if (links.some((link) => isGithubUrl(link.url)))
    derived.push({ label: '깃허브 인증', icon: 'imgGithub', tone: 'gray' });
  // 링크만 추가해서는 주지 않는다. 신청 중(pending)은 숨기고 관리자가 승인한 링크만 인정한다.
  if (links.some((link) => !isGithubUrl(link.url) && link.portfolioBadge === 'approved'))
    derived.push({
      label: '포트폴리오',
      icon: 'imgDescription24DpE3E3E3Fill0Wght300Grad0Opsz241',
      tone: 'blue',
    });
  if ((user.awardHistory ?? []).length > 0)
    derived.push({
      label: '출품이력',
      icon: 'imgTrophy24DpE3E3E3Fill0Wght300Grad0Opsz241',
      tone: 'green',
    });
  const known = new Set(derived.map((badge) => badge.label));
  const extra = (user.badges ?? [])
    .filter((label) => !known.has(label))
    .map((label) => ({ label, icon: 'imgCertificate', tone: 'gray' as const }));
  return [...derived, ...extra];
}

export { DEFAULT_PROFILE_IMAGE, verificationBadges };
