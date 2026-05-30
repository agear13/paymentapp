/** Routes where a single workspace-scoped coordination provider should fetch activation + snapshot. */
export function isWorkspaceCoordinationRoute(pathname: string): boolean {
  if (pathname === '/dashboard' || pathname === '/dashboard/') {
    return false;
  }
  if (pathname.match(/\/dashboard\/projects\/[^/]+/)) {
    return false;
  }
  return pathname.startsWith('/dashboard');
}
