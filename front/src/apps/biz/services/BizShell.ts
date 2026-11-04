export function routeOf(pathname: string) {
  return pathname.startsWith('/biz') ? pathname.slice(4) || '/' : pathname;
}

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const lerpRgba = (
  from: [number, number, number, number],
  to: [number, number, number, number],
  t: number,
) =>
  `rgba(${lerp(from[0], to[0], t).toFixed(1)}, ${lerp(from[1], to[1], t).toFixed(1)}, ${lerp(from[2], to[2], t).toFixed(1)}, ${lerp(from[3], to[3], t).toFixed(3)})`;

const FLOAT_SCROLL_RANGE = 96;
const FLOAT_MAX_WIDTH = 1280;

// 메뉴에 없는 하위 화면이 어느 메뉴 아래에 속하는지 (Figma: 리포트는 광고 관리)
const menuAliases: Record<string, string[]> = {
  '/ads': ['/reports'],
};

export function isMenuActive(route: string, href: string) {
  if (href === '/dashboard') return route === '/' || route === '/dashboard';
  return [href, ...(menuAliases[href] ?? [])].some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`),
  );
}

export { FLOAT_MAX_WIDTH, FLOAT_SCROLL_RANGE, lerp, lerpRgba };
