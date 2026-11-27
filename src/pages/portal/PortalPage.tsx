import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { FormNotice } from '../../components/common/FormNotice';
import { useAuth } from '../../hooks/useAuth';
import { signOutUser } from '../../services/authService';
import { ROUTES } from '../../utils/routes';
import styles from './PortalPage.module.css';

function readText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

/*
  Phase 2 placeholder for the signed-in area. It proves that registration, verification and
  login work end to end. Reports, claims and messages are added to this area in later phases.
*/
export function PortalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const username = readText(user?.user_metadata?.username, 'there');
  const userType = readText(user?.user_metadata?.user_type, 'Not set');

  async function onSignOut() {
    setSigningOut(true);
    setSignOutError(null);

    const result = await signOutUser();
    setSigningOut(false);

    if (result.ok) {
      navigate(ROUTES.home, { replace: true });
    } else {
      setSignOutError(result.message);
    }
  }

  return (
    <div className={`container ${styles.page}`}>
      <span className="eyebrow">Student Web Portal</span>

      <h1 className={styles.title}>
        Hello, <em>{username}</em>.
      </h1>

      <p className={styles.lead}>
        Your account is verified and you are signed in. Reporting items, browsing listings and submitting claims arrive
        in the next phases.
      </p>

      <dl className={styles.account}>
        <div className={styles.accountRow}>
          <dt className={styles.accountLabel}>Signed in as</dt>
          <dd className={styles.accountValue}>{user?.email}</dd>
        </div>
        <div className={styles.accountRow}>
          <dt className={styles.accountLabel}>User type</dt>
          <dd className={styles.accountValue}>{userType}</dd>
        </div>
      </dl>

      {signOutError ? <FormNotice tone="error">{signOutError}</FormNotice> : null}

      <Button variant="secondary" leadingIcon={LogOut} onClick={onSignOut} loading={signingOut}>
        Sign out
      </Button>
    </div>
  );
}
