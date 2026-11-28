import { useCallback, useState } from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/PageLoader';
import { ClaimList } from '../../components/claims/ClaimList';
import { SegmentedControl, type SegmentedOption } from '../../components/forms/SegmentedControl';
import { useResource } from '../../hooks/useResource';
import { listClaimsForReview, type ReviewQueueFilter } from '../../services/claimService';
import { claimRoutes } from '../../utils/routes';
import styles from '../claims/ClaimPages.module.css';

const FILTERS: SegmentedOption<ReviewQueueFilter>[] = [
  { value: 'active', label: 'Needs attention' },
  { value: 'pending', label: 'New' },
  { value: 'approved', label: 'Approved' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

export function AdminClaimsPage() {
  const [filter, setFilter] = useState<ReviewQueueFilter>('active');
  const load = useCallback(() => listClaimsForReview(filter), [filter]);
  const { result, reload } = useResource(load);

  return (
    <div className={`container ${styles.page} ${styles.narrow}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>Review claims</h1>
        <p className={styles.lead}>Oldest first, so nobody waits longer than they have to.</p>
      </header>

      <SegmentedControl legend="Show" value={filter} options={FILTERS} onChange={setFilter} />

      {result === null ? (
        <PageLoader label="Loading claims" />
      ) : !result.ok ? (
        <EmptyState tone="error" title="We could not load claims" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.message}
        </EmptyState>
      ) : result.data.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here">There are no claims in this view.</EmptyState>
      ) : (
        <ClaimList claims={result.data} showClaimant hrefFor={(claim) => claimRoutes.adminDetail(claim.id)} />
      )}
    </div>
  );
}
