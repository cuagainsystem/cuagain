import { Check, PackageCheck, SearchX, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Landing.module.css';

type Pane = {
  icon: LucideIcon;
  title: string;
  intro: string;
  points: ReactNode[];
};

const PANES: Pane[] = [
  {
    icon: SearchX,
    title: 'Reporting something lost',
    intro: 'The more precisely you describe it, the easier it is to recognise.',
    points: [
      <>
        <strong>Name and category.</strong> For example, a black phone with a cracked clear case.
      </>,
      <>
        <strong>Where and when.</strong> Your best guess at the last place and date you had it.
      </>,
      <>
        <strong>Identifying marks.</strong> Stickers, scratches, a keychain or a name written on it.
      </>,
      <>
        <strong>A clear photo,</strong> if you have one from before it went missing.
      </>,
    ],
  },
  {
    icon: PackageCheck,
    title: 'Reporting something found',
    intro: 'Help it reach its owner without giving away everything about it.',
    points: [
      <>
        <strong>Where and when you found it,</strong> and where it is being kept now.
      </>,
      <>
        <strong>A general description.</strong> Keep one or two details back so the real owner can prove it is theirs.
      </>,
      <>
        <strong>A photo of the item.</strong> Photos of IDs and similar items are hidden from public view.
      </>,
      <>
        <strong>No personal numbers.</strong> Do not post ID numbers or card details in the report.
      </>,
    ],
  },
];

export function GuidelinesSection() {
  return (
    <section id="guidelines" className={`container ${styles.section}`} aria-labelledby="guidelines-heading">
      <div className={styles.header}>
        <span className="eyebrow">Report guidelines</span>
        <h2 id="guidelines-heading" className={styles.heading}>
          A good report <em>gets results.</em>
        </h2>
        <p className={styles.lead}>Whether you lost an item or found one, a few clear details make the difference.</p>
      </div>

      <div className={styles.split}>
        {PANES.map(({ icon: Icon, title, intro, points }) => (
          <article key={title} className={styles.splitPane}>
            <div className={styles.paneHeader}>
              <span className={styles.paneIcon}>
                <Icon aria-hidden="true" />
              </span>
              <h3 className={styles.paneTitle}>{title}</h3>
            </div>
            <p className={styles.paneIntro}>{intro}</p>
            <ul className={styles.checklist}>
              {points.map((point, index) => (
                <li key={index} className={styles.checkItem}>
                  <Check aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
