import { useCallback, useState } from 'react';
import { Bell, ClipboardCheck, FileText, LogOut, PackageCheck, PackageSearch, Search, SearchX } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { ReportGrid, ReportGridSkeleton } from '../../components/reports/ReportGrid';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { signOutUser } from '../../services/authService';
import { loadDashboard, type DashboardData } from '../../services/dashboardService';
import { success, type Result } from '../../services/result';
import type { AppRole } from '../../types/database';
import { CLAIM_STATUS_LABELS, CLAIM_STATUS_TONES } from '../../utils/claimLabels';
import { formatTimestamp } from '../../utils/formatDate';
import { reportRoutes, ROUTES } from '../../utils/routes';
import styles from './PortalPage.module.css';

const ROLE_LABELS: Record<AppRole, string> = {
  student: 'Student',
  staff: 'Staff',
  teacher: 'Teacher',
  admin: 'Administrator',
  super_admin: 'Super administrator',
};

function SectionError({ message }: { message: string }) {
  return <FormNotice tone="error">{message}</FormNotice>;
}

/*
  The signed-in home. Every block loads on its own, so a problem in one (say, notifications)
  never hides the rest. The role shown here comes from the database, not from sign-up data.
*/
export function PortalPage() {
  const { user, profile, profileStatus, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? '';

  const load = useCallback(async (): Promise<Result<DashboardData>> => success(await loadDashboard(userId)), [userId]);
  const { result, reload } = useResource(load);
  const data = result?.ok ? result.data : null;

  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    setSignOutError(null);

    const signedOut = await signOutUser();
    setSigningOut(false);

    if (signedOut.ok) {
      navigate(ROUTES.home, { replace: true });
    } else {
      setSignOutError(signedOut.message);
    }
  }

  const username = profile?.username ?? 'there';
  const unread = data?.notifications.ok ? data.notifications.data.filter((item) => !item.isRead).length : 0;
  const activeClaims = data?.claims.ok
    ? data.claims.data.filter((claim) => ['pending', 'under_review', 'more_info_required', 'approved'].includes(claim.status)).length
    : 0;

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.hero}>
        <span className="eyebrow">Student Web Portal</span>
        <h1 className={styles.title}>
          Hello, <em>{username}</em>.
        </h1>
        <p className={styles.lead}>Report something you lost or found, look through what others have reported, and follow your claims.</p>

        <div className={styles.quick}>
          <ButtonLink to={reportRoutes.newReport('lost')} leadingIcon={SearchX}>
            Report lost item
          </ButtonLink>
          <ButtonLink to={reportRoutes.newReport('found')} variant="secondary" leadingIcon={PackageCheck}>
            Report found item
          </ButtonLink>
          <ButtonLink to={ROUTES.reports} variant="secondary" leadingIcon={Search}>
            Browse items
          </ButtonLink>
        </div>
      </header>

      {profileStatus === 'error' ? (
        <div className={styles.stack}>
          <FormNotice tone="error">We could not load your account details.</FormNotice>
          <Button variant="secondary" onClick={refreshProfile}>
            Try again
          </Button>
        </div>
      ) : null}

      {profileStatus === 'missing' ? (
        <FormNotice tone="error">
          Your account has no profile yet. Please sign out and contact the lost and found office.
        </FormNotice>
      ) : null}

      {profile?.status === 'suspended' ? (
        <FormNotice tone="warning" title="Your account is suspended">
          You can look around, but you cannot report, claim or message until the lost and found office restores your account.
        </FormNotice>
      ) : null}

      <section className={styles.stats} aria-label="Your activity">
        <Link to={ROUTES.myReports} className={styles.stat}>
          <FileText aria-hidden="true" />
          <span className={styles.statValue}>{data?.summary.ok ? data.summary.data.total : '-'}</span>
          <span className={styles.statLabel}>Your reports</span>
          <span className={styles.statNote}>{data?.summary.ok ? `${data.summary.data.open} still open` : 'Loading'}</span>
        </Link>
        <div className={styles.stat}>
          <ClipboardCheck aria-hidden="true" />
          <span className={styles.statValue}>{data?.claims.ok ? activeClaims : '-'}</span>
          <span className={styles.statLabel}>Active claims</span>
          <span className={styles.statNote}>Claims open in the next update</span>
        </div>
        <div className={styles.stat}>
          <Bell aria-hidden="true" />
          <span className={styles.statValue}>{data?.notifications.ok ? unread : '-'}</span>
          <span className={styles.statLabel}>Unread notifications</span>
          <span className={styles.statNote}>{unread === 0 ? 'You are all caught up' : 'See below'}</span>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="recent-found">
        <div className={styles.sectionHeader}>
          <h2 id="recent-found" className={styles.sectionTitle}>
            Recently found
          </h2>
          <Link to={`${ROUTES.reports}?type=found`} className={styles.sectionLink}>
            See all found items
          </Link>
        </div>
        {data === null ? (
          <ReportGridSkeleton count={4} />
        ) : !data.recentFound.ok ? (
          <SectionError message={data.recentFound.message} />
        ) : data.recentFound.data.length === 0 ? (
          <EmptyState icon={PackageSearch} title="Nothing found yet">
            Found items appear here as soon as someone reports them.
          </EmptyState>
        ) : (
          <ReportGrid reports={data.recentFound.data} currentUserId={userId} />
        )}
      </section>

      <section className={styles.section} aria-labelledby="recent-lost">
        <div className={styles.sectionHeader}>
          <h2 id="recent-lost" className={styles.sectionTitle}>
            Recently reported lost
          </h2>
          <Link to={`${ROUTES.reports}?type=lost`} className={styles.sectionLink}>
            See all lost items
          </Link>
        </div>
        {data === null ? (
          <ReportGridSkeleton count={4} />
        ) : !data.recentLost.ok ? (
          <SectionError message={data.recentLost.message} />
        ) : data.recentLost.data.length === 0 ? (
          <EmptyState icon={PackageSearch} title="No lost items reported">
            Lost item reports appear here as soon as someone files one.
          </EmptyState>
        ) : (
          <ReportGrid reports={data.recentLost.data} currentUserId={userId} />
        )}
      </section>

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="claims-heading">
          <h2 id="claims-heading" className={styles.sectionTitle}>
            Your claims
          </h2>
          {data === null ? (
            <p className={styles.muted}>Loading</p>
          ) : !data.claims.ok ? (
            <SectionError message={data.claims.message} />
          ) : data.claims.data.length === 0 ? (
            <p className={styles.muted}>You have not claimed anything. When you find your item in the found list, you will be able to claim it here.</p>
          ) : (
            <ul className={styles.list}>
              {data.claims.data.map((claim) => (
                <li key={claim.id} className={styles.listItem}>
                  <div>
                    <p className={styles.itemTitle}>{claim.reportTitle}</p>
                    <p className={styles.itemMeta}>{formatTimestamp(claim.createdAt)}</p>
                  </div>
                  <Badge tone={CLAIM_STATUS_TONES[claim.status]}>{CLAIM_STATUS_LABELS[claim.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="notifications-heading">
          <h2 id="notifications-heading" className={styles.sectionTitle}>
            Notifications
          </h2>
          {data === null ? (
            <p className={styles.muted}>Loading</p>
          ) : !data.notifications.ok ? (
            <SectionError message={data.notifications.message} />
          ) : data.notifications.data.length === 0 ? (
            <p className={styles.muted}>Nothing new. Updates about your reports and claims will show up here.</p>
          ) : (
            <ul className={styles.list}>
              {data.notifications.data.map((item) => (
                <li key={item.id} className={styles.listItem} data-unread={!item.isRead}>
                  <div>
                    <p className={styles.itemTitle}>{item.title}</p>
                    {item.body ? <p className={styles.itemMeta}>{item.body}</p> : null}
                    <p className={styles.itemMeta}>{formatTimestamp(item.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {result !== null && !result.ok ? (
        <div className={styles.stack}>
          <FormNotice tone="error">{result.message}</FormNotice>
          <Button variant="secondary" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : null}

      {profile ? (
        <section className={styles.accountWrap} aria-labelledby="account-heading">
          <h2 id="account-heading" className={styles.sectionTitle}>
            Your account
          </h2>
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
          </dl>
        </section>
      ) : null}

      {signOutError ? <FormNotice tone="error">{signOutError}</FormNotice> : null}

      <Button variant="secondary" leadingIcon={LogOut} onClick={onSignOut} loading={signingOut}>
        Sign out
      </Button>
    </div>
  );
}
