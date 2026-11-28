import { Navigate, Outlet } from 'react-router-dom';
import { EmptyState } from '../common/EmptyState';
import { ButtonLink } from '../common/ButtonLink';
import { PageLoader } from '../common/PageLoader';
import { useAuth } from '../../hooks/useAuth';
import { isAdminRole } from '../../types/database';
import { ROUTES } from '../../utils/routes';

/*
  Keeps administrator screens out of sight for everyone else. This only controls what the
  screen shows. The database refuses the same actions to non-administrators regardless.
*/
export function AdminRoute() {
  const { profile, profileStatus } = useAuth();

  if (profileStatus === 'loading') return <PageLoader label="Checking your access" />;
  if (profileStatus === 'idle') return <Navigate to={ROUTES.login} replace />;

  if (profileStatus !== 'ready' || !isAdminRole(profile?.role)) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <EmptyState
          title="This area is for administrators"
          action={<ButtonLink to={ROUTES.portal} variant="secondary">Back to your portal</ButtonLink>}
        >
          Your account does not have access to this page.
        </EmptyState>
      </div>
    );
  }

  return <Outlet />;
}
