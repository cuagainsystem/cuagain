import { GraduationCap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/routes';
import { ButtonLink } from './ButtonLink';
import type { ButtonSize, ButtonVariant } from './buttonStyles';

type PortalButtonProps = {
  size?: ButtonSize;
  variant?: ButtonVariant;
  className?: string;
};

/** The "Student Web Portal" entry point: sign in when signed out, go straight in when signed in. */
export function PortalButton({ size = 'md', variant = 'primary', className }: PortalButtonProps) {
  const { user } = useAuth();

  return (
    <ButtonLink
      to={user ? ROUTES.portal : ROUTES.login}
      size={size}
      variant={variant}
      leadingIcon={GraduationCap}
      className={className}
    >
      Student Web Portal
    </ButtonLink>
  );
}
