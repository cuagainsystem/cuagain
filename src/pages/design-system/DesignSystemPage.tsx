import { BuildStatusSection } from './BuildStatusSection';
import { ButtonsSection } from './ButtonsSection';
import { ColorSection } from './ColorSection';
import { DataDisplaySection } from './DataDisplaySection';
import { DialogSection } from './DialogSection';
import { FormsSection } from './FormsSection';
import { ScalesSection } from './ScalesSection';
import { TypographySection } from './TypographySection';
import styles from './DesignSystemPage.module.css';

const SECTION_LINKS = [
  { id: 'color', label: 'Colour' },
  { id: 'typography', label: 'Typography' },
  { id: 'spacing', label: 'Spacing and elevation' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'forms', label: 'Form fields' },
  { id: 'data-display', label: 'Badges and cards' },
  { id: 'dialog', label: 'Dialog' },
  { id: 'build-status', label: 'Build status' },
];

/** Living documentation of the visual system. Every token and component is shown with its real styles. */
export function DesignSystemPage() {
  return (
    <div className={`container ${styles.page}`}>
      <nav className={styles.toc} aria-label="Design system sections">
        <p className={`eyebrow ${styles.tocTitle}`}>On this page</p>
        <ul className={styles.tocList}>
          {SECTION_LINKS.map((link) => (
            <li key={link.id}>
              <a href={`#${link.id}`} className={styles.tocLink}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div>
        <header className={styles.intro}>
          <span className="eyebrow">Phase 1 &middot; Foundation</span>
          <h1 className={styles.introTitle}>Design system</h1>
          <p className={styles.introText}>
            Capitol red and white, soft minimalism, and a light touch of neumorphism. Every colour, size and component
            below is read from the same source the app uses, so this page is always accurate.
          </p>
        </header>

        <ColorSection />
        <TypographySection />
        <ScalesSection />
        <ButtonsSection />
        <FormsSection />
        <DataDisplaySection />
        <DialogSection />
        <BuildStatusSection />
      </div>
    </div>
  );
}
