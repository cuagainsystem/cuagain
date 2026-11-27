import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageLoader } from '../common/PageLoader';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/routes';

/*
  Sends signed-out visitors to the login page and brings them back afterwards.
  This only controls what the screen shows. The real protection is Row Level Security
  in the database (Phase 3), because anyone can bypass a browser check.
*/
export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session" />;

  if (!user || !user.email_confirmed_at) {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
