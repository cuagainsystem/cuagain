import type { ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { getButtonClassName, type ButtonSize, type ButtonVariant } from './buttonStyles';

type ButtonLinkProps = Omit<LinkProps, 'children'> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: LucideIcon;
  trailingIcon?: LucideIcon;
};

/** A router link styled as a button. Use it for navigation; use Button for actions. */
export function ButtonLink({
  children,
  variant = 'primary',
  size = 'md',
  leadingIcon: LeadingIcon,
  trailingIcon: TrailingIcon,
  className,
  ...linkProps
}: ButtonLinkProps) {
  return (
    <Link className={getButtonClassName(variant, size, className)} {...linkProps}>
      {LeadingIcon ? <LeadingIcon aria-hidden="true" /> : null}
      <span>{children}</span>
      {TrailingIcon ? <TrailingIcon aria-hidden="true" /> : null}
    </Link>
  );
}
