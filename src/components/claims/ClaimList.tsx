import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ClaimSummary } from '../../types/claim';
import { formatTimestamp } from '../../utils/formatDate';
import { ClaimStatusBadge } from './ClaimStatusBadge';
import styles from './Claims.module.css';

type ClaimListProps = {
  claims: ClaimSummary[];
  /** Builds the address a row links to. */
  hrefFor: (claim: ClaimSummary) => string;
  showClaimant?: boolean;
};

export function ClaimList({ claims, hrefFor, showClaimant }: ClaimListProps) {
  return (
    <ul className={styles.rows}>
      {claims.map((claim) => (
        <li key={claim.id}>
          <Link to={hrefFor(claim)} className={styles.row}>
            <span className={styles.rowMain}>
              <span className={styles.rowTitle}>{claim.reportTitle}</span>
              <span className={styles.rowMeta}>
                {showClaimant && claim.claimantName ? `${claim.claimantName} · ` : ''}
                Sent {formatTimestamp(claim.createdAt)}
              </span>
            </span>
            <ClaimStatusBadge status={claim.status} />
            <ChevronRight aria-hidden="true" className={styles.rowChevron} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
