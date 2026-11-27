import { GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getButtonClassName } from '../../components/common/buttonStyles';
import { ROUTES } from '../../utils/routes';
import styles from './Landing.module.css';

export function FinalCta() {
  const { user } = useAuth();

  return (
    <section className={`container ${styles.sectionTight}`} aria-labelledby="cta-heading">
      <div className={styles.cta}>
        <div>
          <h2 id="cta-heading" className={styles.ctaHeading}>
            Ready to <em>find it again?</em>
          </h2>
          <p className={styles.ctaText}>
            Sign in to the Student Web Portal to report an item or check whether yours has been found.
          </p>
        </div>

        <div className={styles.ctaActions}>
          <Link
            to={user ? ROUTES.portal : ROUTES.login}
            className={getButtonClassName('primary', 'lg', styles.ctaButton)}
          >
            <GraduationCap aria-hidden="true" />
            <span>Student Web Portal</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
