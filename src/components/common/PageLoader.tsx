import { LoaderCircle } from 'lucide-react';
import styles from './PageLoader.module.css';

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className={styles.loader} role="status">
      <LoaderCircle aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
