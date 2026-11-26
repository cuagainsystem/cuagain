import type { ReactNode } from 'react';
import styles from './DesignSystemPage.module.css';

type SectionProps = {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function Section({ id, title, description, children }: SectionProps) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <header className={styles.sectionHeader}>
        <h2 id={`${id}-title`} className={styles.sectionTitle}>
          {title}
        </h2>
        <p className={styles.sectionText}>{description}</p>
      </header>
      {children}
    </section>
  );
}
