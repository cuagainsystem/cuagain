import { useCallback } from 'react';
import { PackageCheck, PackageSearch, SearchX } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { useSearchFilters } from '../../hooks/useSearchFilters';
import { searchReports } from '../../services/reportService';
import { reportRoutes } from '../../utils/routes';
import { Button } from '../common/Button';
import { ButtonLink } from '../common/ButtonLink';
import { EmptyState } from '../common/EmptyState';
import { Pagination } from '../common/Pagination';
import { FilterBar } from './FilterBar';
import { ReportGrid, ReportGridSkeleton } from './ReportGrid';
import styles from './ReportListView.module.css';

type ReportListViewProps = {
  eyebrow: string;
  title: string;
  lead: string;
  /** Only the signed-in user's own reports. */
  mine?: boolean;
  /** Text for the "nothing here yet" state. */
  emptyTitle: string;
  emptyText: string;
};

/** The shared screen behind both "Browse" and "My reports": filters, results and every loading, empty and error state. */
export function ReportListView({ eyebrow, title, lead, mine = false, emptyTitle, emptyText }: ReportListViewProps) {
  const { user } = useAuth();
  const { filters, update, clear } = useSearchFilters();

  const load = useCallback(() => searchReports(filters, { mine }), [filters, mine]);
  const { result, reload } = useResource(load);

  const hasAnyFilter = Boolean(
    filters.query || filters.type || filters.categorySlug || filters.location || filters.from || filters.to || filters.status,
  );

  function changePage(page: number) {
    update({ page });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.lead}>{lead}</p>
        </div>

        <div className={styles.actions}>
          <ButtonLink to={reportRoutes.newReport('lost')} leadingIcon={SearchX}>
            Report lost item
          </ButtonLink>
          <ButtonLink to={reportRoutes.newReport('found')} variant="secondary" leadingIcon={PackageCheck}>
            Report found item
          </ButtonLink>
        </div>
      </header>

      <FilterBar filters={filters} onChange={update} onClear={clear} />

      <section aria-label="Results" className={styles.results}>
        {result === null ? (
          <ReportGridSkeleton />
        ) : !result.ok ? (
          <EmptyState
            tone="error"
            title="We could not load the reports"
            action={
              <Button variant="secondary" onClick={reload}>
                Try again
              </Button>
            }
          >
            {result.message}
          </EmptyState>
        ) : result.data.items.length === 0 ? (
          hasAnyFilter ? (
            <EmptyState
              icon={PackageSearch}
              title="No reports match your search"
              action={
                <Button variant="secondary" onClick={clear}>
                  Clear all filters
                </Button>
              }
            >
              Try a different word, or remove a filter to see more.
            </EmptyState>
          ) : (
            <EmptyState icon={PackageSearch} title={emptyTitle}>
              {emptyText}
            </EmptyState>
          )
        ) : (
          <>
            <p className={styles.count} aria-live="polite">
              {result.data.total === 1 ? '1 report' : `${result.data.total} reports`}
            </p>
            <ReportGrid reports={result.data.items} currentUserId={user?.id} />
            <Pagination page={filters.page} pageCount={result.data.pageCount} onChange={changePage} />
          </>
        )}
      </section>
    </div>
  );
}
