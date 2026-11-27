import type { ReactNode } from 'react';
import type { ListedReport } from '../../types/report';
import { ItemCard } from '../cards/ItemCard';
import { reportRoutes } from '../../utils/routes';
import styles from './ReportGrid.module.css';

type ReportGridProps = {
  reports: ListedReport[];
  /** Shown on cards that belong to the signed-in user. */
  currentUserId?: string;
};

export function ReportGrid({ reports, currentUserId }: ReportGridProps) {
  return (
    <ul className={styles.grid}>
      {reports.map((report) => (
        <li key={report.id} className={styles.cell}>
          {currentUserId && report.reporterId === currentUserId ? <span className={styles.mine}>Your report</span> : null}
          <ItemCard report={report} to={reportRoutes.detail(report.id)} />
        </li>
      ))}
    </ul>
  );
}

/** Grey placeholder cards shown while a list loads, so the page does not jump. */
export function ReportGridSkeleton({ count = 6 }: { count?: number }): ReactNode {
  return (
    <ul className={styles.grid} aria-busy="true" aria-label="Loading reports">
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className={styles.skeleton} aria-hidden="true">
          <div className={styles.skeletonMedia} />
          <div className={styles.skeletonBody}>
            <span className={styles.skeletonLine} style={{ width: '35%' }} />
            <span className={styles.skeletonLine} style={{ width: '80%' }} />
            <span className={styles.skeletonLine} style={{ width: '55%' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
