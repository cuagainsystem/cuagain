/*
  When an emailed link has expired, Supabase sends the visitor back with the problem in the
  URL hash, for example /login#error_code=otp_expired. The Supabase client may clear that hash
  while it starts up, and pages load on demand, so a page could render after the hash is gone.

  This file is imported first in main.tsx and reads the hash exactly once, before anything else
  can change it. Pages then read the saved result instead of the URL.
*/

export type CapturedAuthLinkError = {
  /** The page the error arrived on, so it is only shown there. */
  pathname: string;
  message: string;
};

function capture(): CapturedAuthLinkError | null {
  const hash = window.location.hash;
  if (!hash.includes('error')) return null;

  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.get('error') && !params.get('error_code')) return null;

  const message =
    params.get('error_code') === 'otp_expired'
      ? 'That email link has expired or was already used. Request a new one below.'
      : 'That email link could not be used. Request a new one below.';

  return { pathname: window.location.pathname, message };
}

export const initialAuthLinkError: CapturedAuthLinkError | null = capture();
