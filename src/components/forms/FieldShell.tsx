import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import styles from './Field.module.css';

type FieldShellProps = {
  fieldId: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

/** Label, control slot, hint and error message. Shared by every form field. */
export function FieldShell({ fieldId, label, hint, error, required, children }: FieldShellProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={fieldId} className={styles.label}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {children}

      {error ? (
        <p id={`${fieldId}-error`} className={styles.error} role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
