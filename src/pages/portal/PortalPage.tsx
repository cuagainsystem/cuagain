import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { FormNotice } from '../../components/common/FormNotice';
import { useAuth } from '../../hooks/useAuth';
import type { AppRole } from '../../types/database';
import { signOutUser } from '../../services/authService';
import { ROUTES } from '../../utils/routes';
import styles from './PortalPage.module.css';

const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Student',
  staff: 'Staff',
  teacher: 'Teacher',
  admin: 'Administrator',
  super_admin: 'Super administrator',
};

/*
  Placeholder for the signed-in area. Since Phase 3 the details shown here come from the database
  (profiles and profile_private), so the role is the real, server-controlled one. Reports,
  claims and messages are added to this area in later phases.
*/
export function PortalPage() {
  const { profile, profileStatus, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const username = profile?.username ?? 'there';

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
        You are signed in. Reporting items, browsing listings and submitting claims arrive
        in the next phases.
      </p>

      {profile ? (
        <dl className={styles.account}>
          <div className={styles.accountRow}>
            <dt className={styles.accountLabel}>Signed in as</dt>
            <dd className={styles.accountValue}>{profile.email}</dd>
          </div>
          <div className={styles.accountRow}>
            <dt className={styles.accountLabel}>Student ID</dt>
            <dd className={styles.accountValue}>{profile.student_id}</dd>
          </div>
          <div className={styles.accountRow}>
            <dt className={styles.accountLabel}>Role</dt>
            <dd className={styles.accountValue}>{ROLE_LABELS[profile.role]}</dd>
          </div>
          {profile.status === 'suspended' ? (
            <div className={styles.accountRow}>
              <dt className={styles.accountLabel}>Account</dt>
              <dd className={styles.accountValue}>Suspended. Please contact the lost and found office.</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {profileStatus === 'loading' ? <p className={styles.lead}>Loading your account details.</p> : null}

      {profileStatus === 'error' ? (
        <>
          <FormNotice tone="error">We could not load your account details.</FormNotice>
          <Button variant="secondary" onClick={refreshProfile}>
            Try again
          </Button>
        </>
      ) : null}

      {profileStatus === 'missing' ? (
        <FormNotice tone="error">
          Your account has no profile yet. Please sign out and contact the lost and found office.
        </FormNotice>
      ) : null}

      {signOutError ? <FormNotice tone="error">{signOutError}</FormNotice> : null}

      <Button variant="secondary" leadingIcon={LogOut} onClick={onSignOut} loading={signingOut}>
        Sign out
      </Button>
    </div>
  );
}
