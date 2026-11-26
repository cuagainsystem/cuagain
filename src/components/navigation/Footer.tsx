import { LogoPlaceholder } from '../common/LogoPlaceholder';
import styles from './Footer.module.css';

const CURRENT_YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div>
          <LogoPlaceholder size="sm" />
          <p className={styles.tagline}>Lost Something? Find It Again.</p>
        </div>
        <p className={styles.legal}>Capstone project &middot; {CURRENT_YEAR}</p>
      </div>
    </footer>
  );
}
