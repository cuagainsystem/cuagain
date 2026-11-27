import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { MyProfile } from '../types/database';

/**
 * idle:    nobody is signed in
 * loading: signed in, profile still being fetched
 * ready:   profile loaded
 * missing: signed in but no profile row exists (sign-up did not finish creating it)
 * error:   the profile request failed
 */
export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True while the saved session is being restored on page load. */
  loading: boolean;
  /** False when no Supabase keys have been added yet. */
  isConfigured: boolean;
  /** The signed-in user's profile and role, read from the database (never from sign-up data). */
  profile: MyProfile | null;
  profileStatus: ProfileStatus;
  /** Reload the profile, for example after the user edits it. */
  refreshProfile: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
