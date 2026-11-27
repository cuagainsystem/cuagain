import type { ReactNode } from 'react';
import { CircleAlert, type LucideIcon } from 'lucide-react';
import { classNames } from '../../utils/classNames';
import styles from './EmptyState.module.css';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  /** Usually a button: clear the filters, try again, create a report. */
  action?: ReactNode;
  tone?: 'empty' | 'error';
};

/** One calm block used for "nothing here yet", "nothing matches" and "could not load". */
export function EmptyState({ icon, title, children, action, tone = 'empty' }: EmptyStateProps) {
  const Icon = icon ?? (tone === 'error' ? CircleAlert : undefined);

  return (
    <div className={classNames(styles.state, tone === 'error' && styles.error)} role={tone === 'error' ? 'alert' : undefined}>
      {Icon ? (
        <span className={styles.icon}>
          <Icon aria-hidden="true" />
        </span>
      ) : null}
      <h2 className={styles.title}>{title}</h2>
      {children ? <p className={styles.text}>{children}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
