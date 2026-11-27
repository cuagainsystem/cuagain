import { BellRing, Compass } from 'lucide-react';
import { ItemCard } from '../../components/cards/ItemCard';
import { ButtonLink } from '../../components/common/ButtonLink';
import { PortalButton } from '../../components/common/PortalButton';
import type { ItemReport } from '../../types/report';
import { HOME_SECTIONS } from '../../utils/routes';
import styles from './Landing.module.css';

// A made-up listing that shows visitors what a report looks like. It is not real data.
const EXAMPLE_REPORT: ItemReport = {
  id: 'example',
  type: 'lost',
  title: 'Black umbrella with a wooden handle',
  categorySlug: 'personal-belongings',
  location: 'Library, ground floor',
  occurredOn: '2026-11-24',
  status: 'under_review',
};

export function HeroSection() {
  return (
    <section className={`container ${styles.hero}`} aria-labelledby="hero-heading">
      <div className={styles.heroCopy}>
        <span className="eyebrow">Capitol University lost and found</span>

        <h1 id="hero-heading" className={styles.display}>
          Lost Something? <em>Find It Again.</em>
        </h1>

        <p className={styles.lead}>
          Report a lost belonging, browse what has been found, and get it back through a verified claim. Everything in
          one place, with your personal details kept private.
        </p>

        <div className={styles.heroActions}>
          <PortalButton size="lg" />
          <ButtonLink to={HOME_SECTIONS.howItWorks} variant="secondary" size="lg" leadingIcon={Compass}>
            See how it works
          </ButtonLink>
        </div>

        <p className={styles.heroNote}>For students, staff and teachers with a school email address.</p>
      </div>

      <div className={styles.heroVisual} aria-hidden="true">
        <p className={styles.heroCaption}>Example listing</p>
        <div className={styles.heroCard}>
          <ItemCard report={EXAMPLE_REPORT} />
        </div>

        <div className={styles.matchChip}>
          <span className={styles.matchChipIcon}>
            <BellRing />
          </span>
          <p>
            <strong>Status updated</strong>
            <span>Your report is now under review.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
