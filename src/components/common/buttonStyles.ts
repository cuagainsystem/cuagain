import { classNames } from '../../utils/classNames';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Shared by Button and ButtonLink so a link can look exactly like a button. */
export function getButtonClassName(variant: ButtonVariant, size: ButtonSize, extra?: string): string {
  return classNames(styles.button, styles[variant], styles[size], extra);
}

export const spinnerClassName = styles.spinner;
