import { BadgeCheck, Bell, Search, ShieldCheck, type LucideIcon } from 'lucide-react';
import styles from './Landing.module.css';

type Benefit = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const BENEFITS: Benefit[] = [
  {
    icon: Search,
    title: 'One place to look',
    text: 'Lost and found reports live together, so you can search and filter instead of asking around the campus.',
  },
  {
    icon: ShieldCheck,
    title: 'Private by design',
    text: 'Your student ID and school email are never shown to other users. They only see your username, avatar and user type.',
  },
  {
    icon: BadgeCheck,
    title: 'Claims that are checked',
    text: 'Ownership is reviewed by an administrator before anything is handed over, so items reach the right person.',
  },
  {
    icon: Bell,
    title: 'Always know the status',
    text: 'Follow each report from open to under review, claimed and completed, without chasing anyone for an update.',
  },
];

export function PurposeSection() {
  return (
    <section id="purpose" className={`container ${styles.section}`} aria-labelledby="purpose-heading">
      <div className={styles.purpose}>
        <div className={styles.header}>
          <span className="eyebrow">Why CUAgain</span>
          <h2 id="purpose-heading" className={styles.heading}>
            Lost items should <em>find their way back.</em>
          </h2>
          <p className={styles.lead}>
            Belongings get lost every day and notice boards cannot keep up. CUAgain gives the school community one
            organised, secure place to report, search and recover them.
          </p>
        </div>

        <ul className={styles.benefits}>
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className={styles.benefit}>
              <span className={styles.benefitIcon}>
                <Icon aria-hidden="true" />
              </span>
              <div>
                <h3 className={styles.benefitTitle}>{title}</h3>
                <p className={styles.benefitText}>{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
