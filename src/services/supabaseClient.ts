import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from '../config/env';

/*
  The browser client only ever uses the publishable key. It is safe to expose because
  Row Level Security (Phase 3) decides what each signed-in user can read and write.
  It is null until Supabase is configured, so the app still runs without a backend.
*/
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
