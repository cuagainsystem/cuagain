import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { IdCard, Lock, Mail, UserPlus, UserRound } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AuthShell } from '../../components/auth/AuthShell';
import { NotConfiguredNotice } from '../../components/auth/NotConfiguredNotice';
import { Button } from '../../components/common/Button';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { CheckboxField } from '../../components/forms/CheckboxField';
import { PasswordRequirements } from '../../components/forms/PasswordRequirements';
import { SelectField } from '../../components/forms/SelectField';
import { TextField } from '../../components/forms/TextField';
import { schoolEmailDomain } from '../../config/env';
import { useAuth } from '../../hooks/useAuth';
import { registerAccount } from '../../services/authService';
import { createRegisterSchema, USER_TYPES, type RegisterValues } from '../../utils/authSchemas';
import { ROUTES } from '../../utils/routes';
import formStyles from '../../components/auth/AuthForm.module.css';
import { TermsDialog } from './TermsDialog';

const registerSchema = createRegisterSchema(schoolEmailDomain);
const userTypeOptions = USER_TYPES.map((type) => ({ value: type, label: type }));
const PASSWORD_REQUIREMENTS_ID = 'register-password-requirements';

export function RegisterPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      studentId: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const passwordValue = useWatch({ control, name: 'password' }) ?? '';

  if (loading) return <PageLoader label="Checking your session" />;
  if (user?.email_confirmed_at) return <Navigate to={ROUTES.portal} replace />;

  async function onSubmit(values: RegisterValues) {
    setFormError(null);

    const result = await registerAccount({
      username: values.username,
      studentId: values.studentId,
      email: values.email,
      userType: values.userType,
      password: values.password,
    });

    if (result.ok) {
      navigate(ROUTES.verifyEmail, { state: { email: values.email } });
    } else {
      setFormError(result.message);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Use your school details. We verify your email before you can sign in."
      footer={
        <>
          Already have an account?{' '}
          <Link to={ROUTES.login} className={formStyles.link}>
            Sign in
          </Link>
        </>
      }
    >
      <NotConfiguredNotice />

      <form className={formStyles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <FormNotice tone="error">{formError}</FormNotice> : null}

        <TextField
          label="Username"
          autoComplete="username"
          icon={UserRound}
          hint="This is the only name other users see. Letters, numbers, dots and underscores."
          required
          error={errors.username?.message}
          {...register('username')}
        />

        <div className={formStyles.twoColumns}>
          <TextField
            label="Student ID"
            inputMode="numeric"
            maxLength={7}
            autoComplete="off"
            placeholder="1234567"
            icon={IdCard}
            required
            error={errors.studentId?.message}
            {...register('studentId')}
          />

          <SelectField
            label="User type"
            placeholder="Choose one"
            options={userTypeOptions}
            required
            error={errors.userType?.message}
            {...register('userType')}
          />
        </div>

        <TextField
          label="School email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={schoolEmailDomain ? `1234567@${schoolEmailDomain}` : '1234567@school-domain'}
          icon={Mail}
          hint="The part before the @ must match your student ID."
          required
          error={errors.email?.message}
          {...register('email')}
        />

        <div className={formStyles.twoColumns}>
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            icon={Lock}
            required
            error={errors.password?.message}
            aria-describedby={PASSWORD_REQUIREMENTS_ID}
            {...register('password')}
          />
          <TextField
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            icon={Lock}
            required
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        <PasswordRequirements password={passwordValue} id={PASSWORD_REQUIREMENTS_ID} />

        <div className={formStyles.stack}>
          <CheckboxField
            label="I have read and accept the terms of use."
            error={errors.acceptTerms?.message}
            {...register('acceptTerms')}
          />
          <p className={formStyles.hint}>
            <button type="button" className={formStyles.linkButton} onClick={() => setTermsOpen(true)}>
              Read the terms of use
            </button>
          </p>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} leadingIcon={UserPlus}>
          Create account
        </Button>
      </form>

      <TermsDialog open={termsOpen} onClose={() => setTermsOpen(false)} />
    </AuthShell>
  );
}
