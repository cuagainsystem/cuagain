import { useId } from 'react';
import { classNames } from '../../utils/classNames';
import styles from './SegmentedControl.module.css';

export type SegmentedOption<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  /** Read by screen readers as the name of the group. */
  legend: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

/** A small set of mutually exclusive choices shown side by side. Built on radio buttons, so it works with a keyboard. */
export function SegmentedControl<T extends string>({ legend, value, options, onChange, className }: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <fieldset className={classNames(styles.group, className)}>
      <legend className="visually-hidden">{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className={styles.option} data-checked={option.value === value}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className={styles.input}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
