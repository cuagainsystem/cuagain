import { classNames } from '../../utils/classNames';
import styles from './Communication.module.css';

type UserDotProps = { name: string; size?: 'md' | 'sm' };

/** A round placeholder avatar made from the person's initials. No photos are used. */
export function UserDot({ name, size = 'md' }: UserDotProps) {
  const initials = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  return (
    <span className={classNames(styles.userDot, size === 'sm' && styles.userDotSm)} aria-hidden="true">
      {initials}
    </span>
  );
}
