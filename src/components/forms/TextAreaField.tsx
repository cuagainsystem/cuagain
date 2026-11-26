import { useId, type ComponentProps } from 'react';
import { classNames } from '../../utils/classNames';
import { getDescribedBy } from '../../utils/fieldIds';
import { FieldShell } from './FieldShell';
import styles from './Field.module.css';

type TextAreaFieldProps = Omit<ComponentProps<'textarea'>, 'id'> & {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextAreaField({ id, label, hint, error, required, disabled, ...textareaProps }: TextAreaFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell fieldId={fieldId} label={label} hint={hint} error={error} required={required}>
      <div
        className={classNames(styles.control, styles.textareaControl)}
        data-invalid={Boolean(error)}
        data-disabled={Boolean(disabled)}
      >
        <textarea
          id={fieldId}
          className={classNames(styles.input, styles.textarea)}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={getDescribedBy(fieldId, Boolean(hint), Boolean(error))}
          {...textareaProps}
        />
      </div>
    </FieldShell>
  );
}
