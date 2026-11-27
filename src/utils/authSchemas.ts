import { z } from 'zod';

/*
  Validation rules for every authentication form, taken from the Phase 2 roadmap table.
  This file only depends on zod so the rules are easy to test on their own.
  Browser validation is for usability. Supabase Auth enforces the real security.
*/

export const USER_TYPES = ['Student', 'Staff', 'Teacher'] as const;
export type UserType = (typeof USER_TYPES)[number];

export const STUDENT_ID_PATTERN = /^\d{7}$/;

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt, which Supabase uses, ignores anything past 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

export type PasswordRule = {
  id: string;
  label: string;
  test: (password: string) => boolean;
};

/** The password policy. Mirror it in Supabase: Authentication, Sign In / Providers, Email. */
export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: (value) => value.length >= PASSWORD_MIN_LENGTH },
  { id: 'lower', label: 'One lowercase letter', test: (value) => /[a-z]/.test(value) },
  { id: 'upper', label: 'One uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { id: 'number', label: 'One number', test: (value) => /\d/.test(value) },
];

const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your school email address.')
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.'));

const newPasswordField = z
  .string()
  .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`)
  .refine((value) => PASSWORD_RULES.every((rule) => rule.test(value)), 'Password must meet all the requirements below.');

const confirmPasswordField = z.string().min(1, 'Confirm your password.');

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: newPasswordField,
    confirmPassword: confirmPasswordField,
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
    }
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/** `allowedDomain` is null until the university confirms the approved domain. */
export function createRegisterSchema(allowedDomain: string | null) {
  return z
    .object({
      username: z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters.')
        .max(20, 'Username must be 20 characters or fewer.')
        .regex(/^[a-zA-Z0-9_.]+$/, 'Use letters, numbers, dots and underscores only.'),
      studentId: z.string().trim().regex(STUDENT_ID_PATTERN, 'Student ID must be exactly seven digits.'),
      email: emailField,
      userType: z.enum(USER_TYPES, { error: 'Choose your user type.' }),
      password: newPasswordField,
      confirmPassword: confirmPasswordField,
      acceptTerms: z.boolean().refine((accepted) => accepted, 'You must accept the terms to create an account.'),
    })
    .superRefine((data, ctx) => {
      if (data.password !== data.confirmPassword) {
        ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
      }

      const atIndex = data.email.lastIndexOf('@');
      if (atIndex < 1) return;

      const localPart = data.email.slice(0, atIndex);
      const domain = data.email.slice(atIndex + 1);

      if (allowedDomain && domain !== allowedDomain) {
        ctx.addIssue({
          code: 'custom',
          path: ['email'],
          message: `Use your school email address ending in @${allowedDomain}.`,
        });
        return;
      }

      if (STUDENT_ID_PATTERN.test(data.studentId) && localPart !== data.studentId) {
        ctx.addIssue({
          code: 'custom',
          path: ['email'],
          message: 'The part of your email before the @ must match your student ID.',
        });
      }
    });
}

export type RegisterValues = z.infer<ReturnType<typeof createRegisterSchema>>;
