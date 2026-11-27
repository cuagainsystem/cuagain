import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '../config/env';
import { getMyProfile } from '../services/profileService';
import { supabase } from '../services/supabaseClient';
import type { MyProfile } from '../types/database';
import { AuthContext, type AuthContextValue, type ProfileStatus } from './authContext';

type ProfileState = { userId: string; status: Exclude<ProfileStatus, 'idle' | 'loading'>; profile: MyProfile | null };

/** Keeps the signed-in session and the user's profile in sync, and shares them with the whole app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Nothing to restore when Supabase is not configured, so start in the loaded state.
  const [loading, setLoading] = useState<boolean>(Boolean(supabase));
  const [profileState, setProfileState] = useState<ProfileState | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;

    let active = true;

    getMyProfile(userId).then((result) => {
      if (!active) return;
      if (result.ok) {
        setProfileState({ userId, status: 'ready', profile: result.data });
      } else {
        setProfileState({ userId, status: result.code === 'not_found' ? 'missing' : 'error', profile: null });
      }
    });

    return () => {
      active = false;
    };
  }, [userId, reloadCount]);

  const refreshProfile = useCallback(() => setReloadCount((count) => count + 1), []);

  const value = useMemo<AuthContextValue>(() => {
    // A result that belongs to a previous user must never be shown to the current one.
    const current = userId && profileState?.userId === userId ? profileState : null;

    return {
      session,
      user: session?.user ?? null,
      loading,
      isConfigured: isSupabaseConfigured,
      profile: current?.profile ?? null,
      profileStatus: !userId ? 'idle' : (current?.status ?? 'loading'),
      refreshProfile,
    };
  }, [session, loading, userId, profileState, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
