import styles from './Communication.module.css';

type CountBadgeProps = { count: number; label: string };

/** A small red number. Shows nothing at zero. The label tells screen readers what the number means. */
export function CountBadge({ count, label }: CountBadgeProps) {
  if (count <= 0) return null;
  return (
    <span className={styles.count} role="img" aria-label={`${count} ${label}`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
