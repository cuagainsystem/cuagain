import { ClipboardPen, Handshake, PackageSearch, ScanSearch, UserCheck, type LucideIcon } from 'lucide-react';
import styles from './Landing.module.css';

type ProcessStep = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const STEPS: ProcessStep[] = [
  {
    icon: ClipboardPen,
    title: 'Report',
    text: 'Lost something or found something? Describe it, add where and when, and attach a photo if you have one.',
  },
  {
    icon: ScanSearch,
    title: 'Review',
    text: 'An administrator checks the report so listings stay accurate and safe to share.',
  },
  {
    icon: PackageSearch,
    title: 'Search',
    text: 'Browse listings by category, location and date to see whether your item has turned up.',
  },
  {
    icon: UserCheck,
    title: 'Claim',
    text: 'Found yours? Submit a claim with details only the owner would know.',
  },
  {
    icon: Handshake,
    title: 'Hand over',
    text: 'Once your claim is approved, collect the item and the report is marked completed.',
  },
];

export function ProcessSection() {
  return (
    <div className={styles.band}>
      <section id="how-it-works" className={`container ${styles.section}`} aria-labelledby="process-heading">
        <div className={styles.header}>
          <span className="eyebrow">How it works</span>
          <h2 id="process-heading" className={styles.heading}>
            From missing to <em>returned</em> in five steps.
          </h2>
        </div>

        <ol className={styles.steps}>
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <Icon className={styles.stepIcon} aria-hidden="true" />
              <h3 className={styles.stepTitle}>{title}</h3>
              <p className={styles.stepText}>{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
