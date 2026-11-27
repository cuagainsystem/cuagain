import { useLocation } from 'react-router-dom';
import { initialAuthLinkError } from '../utils/initialUrlError';

/** A friendly message when the visitor arrived through an expired or used email link, otherwise null. */
export function useAuthLinkError(): string | null {
  const { pathname } = useLocation();
  return initialAuthLinkError && initialAuthLinkError.pathname === pathname ? initialAuthLinkError.message : null;
}
