export function routeOf(pathname: string) {
  return pathname.startsWith('/admin') ? pathname.slice('/admin'.length) || '/' : pathname;
}
