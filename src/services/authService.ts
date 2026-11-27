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

export type RegistrationInput = {
  username: string;
  studentId: string;
  email: string;
  userType: UserType;
  password: string;
};

/*
  The profile fields travel as sign-up metadata. In Phase 3 a database trigger copies them
  into the `profiles` table. A user's role is NEVER taken from this metadata: roles are
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
