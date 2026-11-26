import { ArrowLeft } from 'lucide-react';
import { ButtonLink } from '../components/common/ButtonLink';
import { ROUTES } from '../utils/routes';
import styles from './NotFoundPage.module.css';

export function NotFoundPage() {
  return (
    <div className={`container ${styles.page}`}>
      <span className="eyebrow">Page not found</span>
      <p className={styles.code} aria-hidden="true">
        404
      </p>
      <h1>This page seems to be lost.</h1>
      <p className={styles.message}>The link may be broken, or the page may have moved. Let&rsquo;s get you back.</p>
      <ButtonLink to={ROUTES.home} variant="secondary" leadingIcon={ArrowLeft}>
        Back to home
      </ButtonLink>
    </div>
  );
}
