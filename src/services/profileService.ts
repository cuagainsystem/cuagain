import { supabase } from './supabaseClient';
import type { Avatar, MyProfile, PrivateProfile, PublicProfile } from '../types/database';

export type ProfileResult<T> = { ok: true; data: T } | { ok: false; code: 'not_configured' | 'not_found' | 'failed'; message: string };

const NOT_CONFIGURED = { ok: false, code: 'not_configured', message: 'The app is not connected to Supabase yet.' } as const;
const FAILED = { ok: false, code: 'failed', message: 'Could not load your profile. Please try again.' } as const;

/*
  Loads the signed-in user's profile. The two tables are read separately because they have
  different privacy: the public profile is visible to everyone, the private record only to its
  owner (and administrators). Row Level Security decides this on the server, not this code.
*/
export async function getMyProfile(userId: string): Promise<ProfileResult<MyProfile>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const [publicRes, privateRes] = await Promise.all([
      supabase.from('profiles').select('id, username, user_type, avatar_id, created_at').eq('id', userId).maybeSingle(),
      supabase.from('profile_private').select('student_id, email, role, status').eq('id', userId).maybeSingle(),
    ]);

    if (publicRes.error || privateRes.error) return FAILED;
    if (!publicRes.data || !privateRes.data) {
      return { ok: false, code: 'not_found', message: 'Your profile could not be found.' };
    }

    return { ok: true, data: { ...(publicRes.data as PublicProfile), ...(privateRes.data as PrivateProfile) } };
  } catch {
    return FAILED;
  }
}

/** Only these two fields can be changed from the browser. The database refuses anything else. */
export async function updateMyProfile(
  userId: string,
  changes: { username?: string; avatar_id?: string | null },
): Promise<ProfileResult<null>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { error, data } = await supabase.from('profiles').update(changes).eq('id', userId).select('id');

    if (error) {
      if (error.code === '23505') {
        return { ok: false, code: 'failed', message: 'That username is already taken.' };
      }
      if (error.code === '23514') {
        return { ok: false, code: 'failed', message: 'Usernames use 3 to 20 letters, numbers, dots or underscores.' };
      }
      return { ok: false, code: 'failed', message: 'Could not save your changes. Please try again.' };
    }

    // No error but no row means the database filtered the update out (for example a suspended account).
    if (!data || data.length === 0) {
      return { ok: false, code: 'failed', message: 'Your account cannot make changes right now.' };
    }

    return { ok: true, data: null };
  } catch {
    return FAILED;
  }
}

export async function listAvatars(): Promise<ProfileResult<Avatar[]>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from('avatars')
      .select('id, key, label, image_path, sort_order')
      .eq('is_active', true)
      .order('sort_order');

    return error ? FAILED : { ok: true, data: (data ?? []) as Avatar[] };
  } catch {
    return FAILED;
  }
}
