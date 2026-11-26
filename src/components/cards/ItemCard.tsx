import { Link } from 'react-router-dom';
import { CalendarDays, MapPin } from 'lucide-react';
import type { ItemReport } from '../../types/report';
import { ITEM_CATEGORIES } from '../../utils/categories';
import { formatReportDate } from '../../utils/formatDate';
import { ReportTypeBadge } from '../common/ReportTypeBadge';
import { StatusBadge } from '../common/StatusBadge';
import styles from './ItemCard.module.css';

type ItemCardProps = {
  report: ItemReport;
  /** Where the card links to. Leave out for a non-clickable card. */
  to?: string;
};

export function ItemCard({ report, to }: ItemCardProps) {
  const category = ITEM_CATEGORIES[report.categorySlug];
  const CategoryIcon = category.icon;

  // Photos of sensitive items (such as IDs) are never shown publicly.
  const imageIsRestricted = category.restrictsPublicImage;
  const showImage = Boolean(report.imageUrl) && !imageIsRestricted;
  const dateLabel = report.type === 'lost' ? 'Lost on' : 'Found on';

  return (
    <article className={styles.card} data-interactive={Boolean(to)}>
      <div className={styles.media}>
        {showImage ? (
          <img src={report.imageUrl} alt={`Photo of ${report.title}`} loading="lazy" />
        ) : (
          <div className={styles.placeholder}>
            <CategoryIcon aria-hidden="true" />
            <span className={styles.placeholderNote}>
              {imageIsRestricted ? 'Photo hidden for privacy' : 'No photo added'}
            </span>
          </div>
        )}
        <div className={styles.typeBadge}>
          <ReportTypeBadge type={report.type} />
        </div>
      </div>

      <div className={styles.body}>
        <p className={styles.category}>{category.label}</p>

        <h3 className={styles.title}>
          {to ? (
            <Link to={to} className={styles.titleLink}>
              {report.title}
            </Link>
          ) : (
            report.title
          )}
        </h3>

        <dl className={styles.meta}>
          <div className={styles.metaRow}>
            <dt>
              <MapPin aria-hidden="true" />
              <span className="visually-hidden">Location</span>
            </dt>
            <dd>{report.location}</dd>
          </div>
          <div className={styles.metaRow}>
            <dt>
              <CalendarDays aria-hidden="true" />
              <span className="visually-hidden">{dateLabel}</span>
            </dt>
            <dd>{formatReportDate(report.occurredOn)}</dd>
          </div>
        </dl>

        <div className={styles.footer}>
          <StatusBadge status={report.status} />
        </div>
      </div>
    </article>
  );
}
