import { ROUTES } from './routes';

/**
 * Reads the page a visitor was trying to reach before being sent to log in.
 * Only on-site paths are accepted, so a crafted link can never send someone to another website.
 */
export function getSafeRedirectPath(locationState: unknown): string {
  if (typeof locationState !== 'object' || locationState === null || !('from' in locationState)) {
    return ROUTES.portal;
  }

  const from = (locationState as { from: unknown }).from;
  const isOnSitePath = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//');
  const isAuthPage = typeof from === 'string' && from.startsWith(ROUTES.login);

  return isOnSitePath && !isAuthPage ? from : ROUTES.portal;
}
