import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { BadgeTone } from '../../types/ui';
import { classNames } from '../../utils/classNames';
import styles from './Badge.module.css';

type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  icon?: LucideIcon;
};

export function Badge({ children, tone = 'neutral', icon: Icon }: BadgeProps) {
  return (
    <span className={classNames(styles.badge, styles[tone])}>
      {Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
