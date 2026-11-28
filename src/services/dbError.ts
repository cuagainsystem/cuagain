import { failure, type Result } from './result';

export type DbError = { code?: string; message?: string } | null;

/*
  Messages raised on purpose by the database rules (for example "You cannot message this person.")
  are written for people, so they are shown as they are. Anything else becomes a generic message.
*/
export function friendlyError(error: NonNullable<DbError>, fallback: string): Result<never> {
  const deliberate = error.code === '23514' || error.code === '42501' || error.code === 'P0002';
  if (deliberate && error.message) return failure(error.message);
  if (error.code === '23505') return failure('That was already done.');
  return failure(fallback);
}
