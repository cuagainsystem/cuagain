import type { AuthError } from '@supabase/supabase-js';
import type { UserType } from '../utils/authSchemas';
import { ROUTES } from '../utils/routes';
import { supabase } from './supabaseClient';

export type AuthErrorCode =
  | 'not_configured'
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'weak_password'
  | 'same_password'
  | 'unknown';

export type AuthResult = { ok: true } | { ok: false; code: AuthErrorCode; message: string };

const OK: AuthResult = { ok: true };

function fail(code: AuthErrorCode, message: string): AuthResult {
  return { ok: false, code, message };
}

const NOT_CONFIGURED = fail('not_configured', 'The app is not connected to Supabase yet. Add your keys to .env.local.');
const NETWORK_FAILURE = fail('unknown', 'Could not reach the server. Check your connection and try again.');

/** Turns a Supabase error into a short message that is safe to show. Raw errors are never shown. */
function toFailure(error: AuthError): AuthResult {
  switch (error.code) {
    case 'invalid_credentials':
      return fail('invalid_credentials', 'Email or password is incorrect.');
    case 'email_not_confirmed':
      return fail('email_not_confirmed', 'Please verify your email address before signing in.');
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return fail('rate_limited', 'Too many attempts. Please wait a few minutes and try again.');
    case 'weak_password':
      return fail('weak_password', 'Choose a stronger password.');
    case 'same_password':
      return fail('same_password', 'Your new password must be different from your current one.');
    default:
      if (error.status === 429) {
        return fail('rate_limited', 'Too many attempts. Please wait a few minutes and try again.');
      }
      return fail('unknown', 'Something went wrong. Please try again.');
  }
}

const REGISTRATION_REJECTED = fail(
  'unknown',
  "We could not create this account. The username or student ID may already be in use, or your details did not match the school's requirements.",
);

/*
  When the database trigger refuses a sign-up (duplicate username or student ID, a rule the
  browser check missed), Supabase answers with a plain HTTP 500 and no error code. Gateway
  errors (502 and above) are real outages and keep the generic message.
*/
function isRejectedByDatabase(error: AuthError): boolean {
  return error.status === 500 || error.code === 'unexpected_failure';
}

export type RegistrationInput = {
  username: string;
  studentId: string;
  email: string;
  userType: UserType;
  password: string;
};

/*
  The profile fields travel as sign-up metadata. A database trigger (migration 2) validates them
  and copies them into the `profiles` and `profile_private` tables. A user's role is NEVER taken from this metadata: roles are
  assigned only on the server, so nobody can make themselves an administrator.
*/
export async function registerAccount(input: RegistrationInput): Promise<AuthResult> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: `${window.location.origin}${ROUTES.login}`,
        data: {
          username: input.username,
          student_id: input.studentId,
          user_type: input.userType,
        },
      },
    });

    if (error && isRejectedByDatabase(error)) return REGISTRATION_REJECTED;

    // An already-registered email is reported as success so the form never reveals who has an account.
    return error ? toFailure(error) : OK;
  } catch {
    return NETWORK_FAILURE;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? toFailure(error) : OK;
  } catch {
    return NETWORK_FAILURE;
  }
}

export async function signOutUser(): Promise<AuthResult> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { error } = await supabase.auth.signOut();
    return error ? toFailure(error) : OK;
  } catch {
    return NETWORK_FAILURE;
  }
}

export async function resendVerificationEmail(email: string): Promise<AuthResult> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}${ROUTES.login}` },
    });
    return error ? toFailure(error) : OK;
  } catch {
    return NETWORK_FAILURE;
  }
}

/** Always reports success for unknown emails, so the form never reveals who has an account. */
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${ROUTES.resetPassword}`,
    });
    return error && error.code?.includes('rate_limit') ? toFailure(error) : OK;
  } catch {
    return NETWORK_FAILURE;
  }
}

/** Works only while the user has a valid recovery session from the reset email link. */
export async function setNewPassword(password: string): Promise<AuthResult> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? toFailure(error) : OK;
  } catch {
    return NETWORK_FAILURE;
  }
}
