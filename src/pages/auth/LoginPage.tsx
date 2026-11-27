import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, LogIn, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { NotConfiguredNotice } from '../../components/auth/NotConfiguredNotice';
import { Button } from '../../components/common/Button';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { TextField } from '../../components/forms/TextField';
import { useAuth } from '../../hooks/useAuth';
import { useAuthLinkError } from '../../hooks/useAuthLinkError';
import { useCooldown } from '../../hooks/useCooldown';
import { resendVerificationEmail, signInWithEmail, type AuthResult } from '../../services/authService';
import { loginSchema, type LoginValues } from '../../utils/authSchemas';
import { getSafeRedirectPath } from '../../utils/redirect';
import { ROUTES } from '../../utils/routes';
import formStyles from '../../components/auth/AuthForm.module.css';

type Failure = Extract<AuthResult, { ok: false }>;

export function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const linkError = useAuthLinkError();
  const resendCooldown = useCooldown(60);

  const [failure, setFailure] = useState<Failure | null>(null);
  const [resendMessage, setResendMessage] = useState<AuthResult | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const redirectTo = getSafeRedirectPath(location.state);
  const justResetPassword = Boolean((location.state as { passwordReset?: boolean } | null)?.passwordReset);

  if (loading) return <PageLoader label="Checking your session" />;
  if (user?.email_confirmed_at) return <Navigate to={redirectTo} replace />;

  async function onSubmit(values: LoginValues) {
    setFailure(null);
    setResendMessage(null);

    const result = await signInWithEmail(values.email, values.password);
    if (result.ok) {
      navigate(redirectTo, { replace: true });
    } else {
      setFailure(result);
    }
  }

  async function onResend() {
    const email = getValues('email').trim().toLowerCase();
    if (!email) return;

    const result = await resendVerificationEmail(email);
    setResendMessage(result);
    if (result.ok) resendCooldown.start();
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your school email to report items, check listings and manage claims."
      footer={
        <>
          New to CUAgain?{' '}
          <Link to={ROUTES.register} className={formStyles.link}>
            Create an account
          </Link>
        </>
      }
    >
      <NotConfiguredNotice />

      {justResetPassword ? (
        <FormNotice tone="success">Your password was updated. Sign in with your new password.</FormNotice>
      ) : null}
      {linkError ? <FormNotice tone="warning">{linkError}</FormNotice> : null}

      <form className={formStyles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {failure ? <FormNotice tone="error">{failure.message}</FormNotice> : null}

        {failure?.code === 'email_not_confirmed' ? (
          <div className={formStyles.stack}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onResend}
              disabled={resendCooldown.remaining > 0}
              leadingIcon={Mail}
            >
              {resendCooldown.remaining > 0
                ? `Resend available in ${resendCooldown.remaining}s`
                : 'Resend verification email'}
            </Button>
            {resendMessage?.ok ? (
              <FormNotice tone="success">A new verification email is on its way. Check your inbox and spam folder.</FormNotice>
            ) : null}
            {resendMessage && !resendMessage.ok ? <FormNotice tone="error">{resendMessage.message}</FormNotice> : null}
          </div>
        ) : null}

        <TextField
          label="School email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="1234567@school-domain"
          icon={Mail}
          required
          error={errors.email?.message}
          {...register('email')}
        />

        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          icon={Lock}
          required
          error={errors.password?.message}
          {...register('password')}
        />

        <div className={formStyles.row}>
          <Link to={ROUTES.forgotPassword} className={formStyles.link}>
            Forgot your password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} leadingIcon={LogIn}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
