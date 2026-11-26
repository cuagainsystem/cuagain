import { useId, type ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { classNames } from '../../utils/classNames';
import { getDescribedBy } from '../../utils/fieldIds';
import { FieldShell } from './FieldShell';
import styles from './Field.module.css';

export type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = Omit<ComponentProps<'select'>, 'id' | 'children'> & {
  id?: string;
  label: string;
  options: SelectOption[];
  /** Text of the empty first option, for example "Choose a category". */
  placeholder?: string;
  hint?: string;
  error?: string;
};

export function SelectField({
  id,
  label,
  options,
  placeholder,
  hint,
  error,
  required,
  disabled,
  ...selectProps
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <FieldShell fieldId={fieldId} label={label} hint={hint} error={error} required={required}>
      <div className={styles.control} data-invalid={Boolean(error)} data-disabled={Boolean(disabled)}>
        <select
          id={fieldId}
          className={classNames(styles.input, styles.select)}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={getDescribedBy(fieldId, Boolean(hint), Boolean(error))}
          {...selectProps}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </div>
    </FieldShell>
  );
}
