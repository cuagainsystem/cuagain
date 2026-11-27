import { createContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True while the saved session is being restored on page load. */
  loading: boolean;
  /** False when no Supabase keys have been added yet. */
  isConfigured: boolean;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
