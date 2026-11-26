import type { ComponentProps, ReactNode } from 'react';
import { LoaderCircle, type LucideIcon } from 'lucide-react';
import { getButtonClassName, spinnerClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';

type ButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
  loading?: boolean;
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  loading = false,
  disabled,
  className,
  type = 'button',
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type={type}
      className={getButtonClassName(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...buttonProps}
    >
      {loading ? <LoaderCircle className={spinnerClassName} aria-hidden="true" /> : null}
      {!loading && LeadingIcon ? <LeadingIcon aria-hidden="true" /> : null}
      <span>{children}</span>
      {TrailingIcon ? <TrailingIcon aria-hidden="true" /> : null}
    </button>
  );
}
