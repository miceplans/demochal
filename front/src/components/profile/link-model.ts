// 프로필 링크(externalLinks)의 표시·저장 규칙 — /profile과 MY 페이지가 같은 규칙을 쓴다.
export type LinkLike = { label?: string; url?: string };

export const isGithubUrl = (url?: string) => (url ?? '').toLowerCase().includes('github.com');

export const linkIconName = (url?: string) => (isGithubUrl(url) ? 'imgLink1Icon' : 'imgLink2Icon');

export const linkDisplayText = (link: LinkLike) =>
  (link.url ?? '').replace(/^https?:\/\//, '').replace(/\/$/, '') || (link.label ?? '');

// http/https만 다른 사용자에게 렌더한다. javascript: 등이 저장 데이터에 섞여 있어도 표시하지 않는다.
export const isSafeLinkUrl = (url?: string) => /^https?:\/\//i.test(url ?? '');

// 저장용 URL로 정규화한다. 스킴이 없으면 https://를 붙이고, http/https가 아닌 스킴이나
// 형식이 잘못된 URL은 null을 반환해 저장을 막는다.
export function normalizeLinkUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) {
    try {
      new URL(value);
      return value;
    } catch {
      return null;
    }
  }
  // javascript:, data: 등 다른 스킴은 저장하지 않는다.
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  try {
    new URL(`https://${value}`);
    return `https://${value}`;
  } catch {
    return null;
  }
}
