import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Mail, MailCheck, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { NotConfiguredNotice } from '../../components/auth/NotConfiguredNotice';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { FormNotice } from '../../components/common/FormNotice';
import { TextField } from '../../components/forms/TextField';
import { sendPasswordReset } from '../../services/authService';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../../utils/authSchemas';
import { ROUTES } from '../../utils/routes';
import formStyles from '../../components/auth/AuthForm.module.css';

export function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);

    const result = await sendPasswordReset(values.email);
    if (result.ok) {
      setSentTo(values.email);
    } else {
      setFormError(result.message);
    }
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your email" subtitle="If we can reach that address, a reset link is on its way.">
        <div className={formStyles.stack}>
          <span className={formStyles.statusIcon}>
            <MailCheck aria-hidden="true" />
          </span>
          <p>
            If an account exists for <strong>{sentTo}</strong>, you will receive a link to choose a new password. The link
            works only for a short time.
          </p>
          <p className={formStyles.hint}>Nothing yet? Check your spam folder, or try again with the correct address.</p>
          <div>
            <ButtonLink to={ROUTES.login} variant="secondary" leadingIcon={ArrowLeft}>
              Back to sign in
            </ButtonLink>
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your school email and we will send you a secure link."
      footer={
        <>
          Remembered it?{' '}
          <Link to={ROUTES.login} className={formStyles.link}>
            Back to sign in
          </Link>
        </>
      }
    >
      <NotConfiguredNotice />

      <form className={formStyles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <FormNotice tone="error">{formError}</FormNotice> : null}

        <TextField
          label="School email"
          type="email"
          autoComplete="email"
          inputMode="email"
          icon={Mail}
          required
          error={errors.email?.message}
          {...register('email')}
        />

        <Button type="submit" size="lg" loading={isSubmitting} leadingIcon={Send}>
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
