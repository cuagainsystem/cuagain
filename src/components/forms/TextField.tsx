import { useId, useState, type ComponentProps } from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { getDescribedBy } from '../../utils/fieldIds';
import { FieldShell } from './FieldShell';
import styles from './Field.module.css';

type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  icon?: LucideIcon;
};

/** Single-line input. A type of "password" automatically gets a show/hide toggle. */
export function TextField({
  id,
  label,
  hint,
  error,
  icon: Icon,
  required,
  disabled,
  type = 'text',
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [passwordVisible, setPasswordVisible] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword && passwordVisible ? 'text' : type;

  return (
    <FieldShell fieldId={fieldId} label={label} hint={hint} error={error} required={required}>
      <div className={styles.control} data-invalid={Boolean(error)} data-disabled={Boolean(disabled)}>
        {Icon ? <Icon aria-hidden="true" /> : null}

        <input
          id={fieldId}
          type={inputType}
          className={styles.input}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={getDescribedBy(fieldId, Boolean(hint), Boolean(error))}
          {...inputProps}
        />

        {isPassword ? (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? 'Hide password' : 'Show password'}
            aria-pressed={passwordVisible}
            disabled={disabled}
          >
            {passwordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        ) : null}
      </div>
    </FieldShell>
  );
}
