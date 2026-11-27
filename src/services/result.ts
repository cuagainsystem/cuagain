/** What every data service returns: either the data, or a short message that is safe to show. */
export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

export function success<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function failure(message: string): Result<never> {
  return { ok: false, message };
}

export const NOT_CONFIGURED = failure('The app is not connected to Supabase yet.');
export const GENERIC_FAILURE = failure('Something went wrong. Please try again.');
export const NETWORK_FAILURE = failure('Could not reach the server. Check your connection and try again.');
