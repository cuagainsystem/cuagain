import { useState } from 'react';
import { MailCheck, RefreshCw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { Button } from '../../components/common/Button';
import { FormNotice } from '../../components/common/FormNotice';
import { useCooldown } from '../../hooks/useCooldown';
import { resendVerificationEmail, type AuthResult } from '../../services/authService';
import { ROUTES } from '../../utils/routes';
import formStyles from '../../components/auth/AuthForm.module.css';

export function VerifyEmailPage() {
  const location = useLocation();
  const cooldown = useCooldown(60);
  const [resendResult, setResendResult] = useState<AuthResult | null>(null);
  const [resending, setResending] = useState(false);

  // The address is passed in router state, never in the URL, so it is not saved in history or logs.
  const emailState = (location.state as { email?: unknown } | null)?.email;
  const email = typeof emailState === 'string' ? emailState : null;

  async function onResend() {
    if (!email) return;
    setResending(true);
    const result = await resendVerificationEmail(email);
    setResendResult(result);
    setResending(false);
    if (result.ok) cooldown.start();
  }

  return (
    <AuthShell
      title="Check your email"
      subtitle="One more step. Open the link we sent to activate your account."
      footer={
        <>
          Already verified?{' '}
          <Link to={ROUTES.login} className={formStyles.link}>
            Sign in
          </Link>
        </>
      }
    >
      <div className={formStyles.stack}>
        <span className={formStyles.statusIcon}>
          <MailCheck aria-hidden="true" />
        </span>

        <p>
          {email ? (
            <>
              We sent a verification link to <strong>{email}</strong>.
            </>
          ) : (
            'We sent a verification link to the school email address you registered with.'
          )}{' '}
          You can sign in once you have opened it.
        </p>

        <p className={formStyles.hint}>
          Nothing in your inbox? Check your spam folder, and make sure the address is spelled correctly.
        </p>

        {resendResult?.ok ? (
          <FormNotice tone="success">A new verification email is on its way.</FormNotice>
        ) : null}
        {resendResult && !resendResult.ok ? <FormNotice tone="error">{resendResult.message}</FormNotice> : null}

        {email ? (
          <div>
            <Button
              variant="secondary"
              leadingIcon={RefreshCw}
              onClick={onResend}
              loading={resending}
              disabled={cooldown.remaining > 0}
            >
              {cooldown.remaining > 0 ? `Resend available in ${cooldown.remaining}s` : 'Resend verification email'}
            </Button>
          </div>
        ) : null}
      </div>
    </AuthShell>
  );
}
