import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Lock, LinkIcon } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { PasswordRequirements } from '../../components/forms/PasswordRequirements';
import { TextField } from '../../components/forms/TextField';
import { useAuth } from '../../hooks/useAuth';
import { setNewPassword, signOutUser } from '../../services/authService';
import { resetPasswordSchema, type ResetPasswordValues } from '../../utils/authSchemas';
import { ROUTES } from '../../utils/routes';
import formStyles from '../../components/auth/AuthForm.module.css';

const PASSWORD_REQUIREMENTS_ID = 'reset-password-requirements';

export function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const passwordValue = useWatch({ control, name: 'password' }) ?? '';

  if (loading) return <PageLoader label="Checking your reset link" />;

  // Opening the emailed link signs the user in briefly. Without that session the link was missing, used or expired.
  if (!user) {
    return (
      <AuthShell title="This link is not valid" subtitle="Reset links work once and expire after a short time.">
        <div className={formStyles.stack}>
          <span className={formStyles.statusIcon}>
            <LinkIcon aria-hidden="true" />
          </span>
          <p>Request a new link and open it from the same device.</p>
          <div>
            <ButtonLink to={ROUTES.forgotPassword} leadingIcon={KeyRound}>
              Request a new link
            </ButtonLink>
          </div>
        </div>
      </AuthShell>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);

    const result = await setNewPassword(values.password);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    // Sign out so the new password is confirmed by signing in again.
    await signOutUser();
    navigate(ROUTES.login, { replace: true, state: { passwordReset: true } });
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Pick a password you have not used on CUAgain before.">
      <form className={formStyles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <FormNotice tone="error">{formError}</FormNotice> : null}

        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          icon={Lock}
          required
          error={errors.password?.message}
          aria-describedby={PASSWORD_REQUIREMENTS_ID}
          {...register('password')}
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          icon={Lock}
          required
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <PasswordRequirements password={passwordValue} id={PASSWORD_REQUIREMENTS_ID} />

        <Button type="submit" size="lg" loading={isSubmitting} leadingIcon={KeyRound}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}
