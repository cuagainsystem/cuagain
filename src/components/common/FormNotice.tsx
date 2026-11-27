import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { classNames } from '../../utils/classNames';
import styles from './FormNotice.module.css';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

const NOTICE_ICONS: Record<NoticeTone, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

type FormNoticeProps = {
  tone: NoticeTone;
  title?: string;
  children: ReactNode;
};

/** A message banner for a whole form. Errors interrupt screen readers; other tones wait politely. */
export function FormNotice({ tone, title, children }: FormNoticeProps) {
  const Icon = NOTICE_ICONS[tone];

  return (
    <div className={classNames(styles.notice, styles[tone])} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div className={styles.content}>
        {title ? <p className={styles.title}>{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
