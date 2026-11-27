import { useId, type ComponentProps, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import styles from './CheckboxField.module.css';

type CheckboxFieldProps = Omit<ComponentProps<'input'>, 'id' | 'type' | 'children'> & {
  id?: string;
  /** The text beside the box. Keep it to plain text: a button or link inside a label is invalid HTML. */
  label: ReactNode;
  error?: string;
};

export function CheckboxField({ id, label, error, ...inputProps }: CheckboxFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>
        <input
          id={fieldId}
          type="checkbox"
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...inputProps}
        />
        <label htmlFor={fieldId}>{label}</label>
      </div>

      {error ? (
        <p id={`${fieldId}-error`} className={styles.error} role="alert">
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
