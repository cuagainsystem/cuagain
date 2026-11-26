import { classNames } from '../../utils/classNames';
import styles from './LogoPlaceholder.module.css';

type LogoPlaceholderProps = {
  size?: 'sm' | 'md';
};

/*
  Temporary brand slot. The dashed box marks where the real logo goes.
  When the logo is ready, replace the .mark element with an <img> from /public/logo.
*/
export function LogoPlaceholder({ size = 'md' }: LogoPlaceholderProps) {
  return (
    <span className={classNames(styles.logo, styles[size])}>
      <span className={styles.mark} aria-hidden="true">
        Logo
      </span>
      <span className={styles.wordmark}>
        <span className={styles.accent}>CUA</span>gain
      </span>
    </span>
  );
}
