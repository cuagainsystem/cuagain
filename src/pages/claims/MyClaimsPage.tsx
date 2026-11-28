import { useCallback } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { EmptyState } from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/PageLoader';
import { ClaimList } from '../../components/claims/ClaimList';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { listMyClaims } from '../../services/claimService';
import { claimRoutes, ROUTES } from '../../utils/routes';
import styles from './ClaimPages.module.css';

export function MyClaimsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const load = useCallback(() => listMyClaims(userId), [userId]);
  const { result, reload } = useResource(load);

  return (
    <div className={`container ${styles.page} ${styles.narrow}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>My claims</h1>
        <p className={styles.lead}>Items you asked to claim, and where each request stands.</p>
      </header>

      {result === null ? (
        <PageLoader label="Loading your claims" />
      ) : !result.ok ? (
        <EmptyState tone="error" title="We could not load your claims" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.message}
        </EmptyState>
      ) : result.data.length === 0 ? (
        <EmptyState icon={ClipboardList} title="You have not claimed anything" action={<ButtonLink to={ROUTES.reports}>Browse found items</ButtonLink>}>
          If you see something that is yours, open it and choose &quot;Claim this item&quot;.
        </EmptyState>
      ) : (
        <ClaimList claims={result.data} hrefFor={(claim) => claimRoutes.detail(claim.id)} />
      )}
    </div>
  );
}
