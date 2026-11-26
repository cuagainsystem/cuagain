import { ItemCard } from '../../components/cards/ItemCard';
import { Badge } from '../../components/common/Badge';
import { ReportTypeBadge } from '../../components/common/ReportTypeBadge';
import { StatusBadge } from '../../components/common/StatusBadge';
import type { ItemReport, ReportStatus } from '../../types/report';
import { CATEGORY_SLUGS, ITEM_CATEGORIES } from '../../utils/categories';
import { Section } from './Section';
import styles from './DesignSystemPage.module.css';

const STATUSES: ReportStatus[] = ['open', 'under_review', 'claimed', 'completed'];

const SAMPLE_REPORTS: ItemReport[] = [
  {
    id: 'sample-1',
    type: 'lost',
    title: 'Black phone with a cracked clear case',
    categorySlug: 'electronics',
    location: 'Library, second floor',
    occurredOn: '2026-11-24',
    status: 'open',
  },
  {
    id: 'sample-2',
    type: 'found',
    title: 'Silver wristwatch with a leather strap',
    categorySlug: 'accessories',
    location: 'Cafeteria',
    occurredOn: '2026-11-25',
    status: 'under_review',
  },
  {
    id: 'sample-3',
    type: 'found',
    title: 'School ID card',
    categorySlug: 'identification',
    location: 'Gymnasium entrance',
    occurredOn: '2026-11-23',
    status: 'open',
    // Has a photo, but the Identification category hides it from public view.
    imageUrl: '/assets/sample-id.jpg',
  },
  {
    id: 'sample-4',
    type: 'found',
    title: 'Navy blue PE jacket',
    categorySlug: 'clothing',
    location: 'Room 204',
    occurredOn: '2026-11-20',
    status: 'completed',
  },
];

export function DataDisplaySection() {
  return (
    <Section
      id="data-display"
      title="Badges, cards and icons"
      description="Item cards are the heart of the product. Status and type badges use colour and a text label together, so meaning never depends on colour alone."
    >
      <div className={styles.group}>
        <h3 className={styles.subheading}>Report type</h3>
        <div className={styles.row}>
          <ReportTypeBadge type="lost" />
          <ReportTypeBadge type="found" />
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>Report status</h3>
        <div className={styles.row}>
          {STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
          <Badge tone="primary">Primary tone</Badge>
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>Item cards</h3>
        <div className={styles.cardGrid}>
          {SAMPLE_REPORTS.map((report) => (
            <ItemCard key={report.id} report={report} />
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <h3 className={styles.subheading}>Category icons</h3>
        <ul className={styles.iconGrid}>
          {CATEGORY_SLUGS.map((slug) => {
            const category = ITEM_CATEGORIES[slug];
            const CategoryIcon = category.icon;

            return (
              <li key={slug} className={styles.iconTile}>
                <CategoryIcon aria-hidden="true" />
                <span className={styles.iconLabel}>{category.label}</span>
                <span className={styles.iconExamples}>{category.examples}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
