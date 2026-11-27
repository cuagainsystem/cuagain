import { Link } from 'react-router-dom';
import { HOME_SECTIONS, ROUTES } from '../../utils/routes';
import { LogoPlaceholder } from '../common/LogoPlaceholder';
import styles from './Footer.module.css';

const CURRENT_YEAR = new Date().getFullYear();

const FOOTER_LINKS = [
  { label: 'How it works', to: HOME_SECTIONS.howItWorks },
  { label: 'Guidelines', to: HOME_SECTIONS.guidelines },
  { label: 'Claiming', to: HOME_SECTIONS.claiming },
  { label: 'FAQs', to: HOME_SECTIONS.faqs },
  { label: 'Student Web Portal', to: ROUTES.portal },
  { label: 'Design system', to: ROUTES.designSystem },
];

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div>
          <LogoPlaceholder size="sm" />
          <p className={styles.tagline}>Lost Something? Find It Again.</p>
        </div>

        <nav aria-label="Footer">
          <ul className={styles.links}>
            {FOOTER_LINKS.map(({ label, to }) => (
              <li key={to}>
                <Link to={to} className={styles.link}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <p className={styles.legal}>Capstone project &middot; {CURRENT_YEAR}</p>
      </div>
    </footer>
  );
}
