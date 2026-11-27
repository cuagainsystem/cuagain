/*
  Public configuration read from .env.local (see .env.example).
  Only values that are safe to expose in the browser belong here.
*/

const env = import.meta.env;

export const supabaseUrl: string = String(env.VITE_SUPABASE_URL ?? '').trim();
export const supabasePublishableKey: string = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

/** False until a Supabase project URL and publishable key are added to .env.local. */
export const isSupabaseConfigured: boolean = Boolean(supabaseUrl && supabasePublishableKey);

/*
  The approved school email domain, for example "g.cu.edu.ph".
  The roadmap says to confirm the exact domain with the university before enforcing it,
  so registration only enforces the domain once this value is set.
*/
const rawDomain = String(env.VITE_SCHOOL_EMAIL_DOMAIN ?? '')
  .trim()
  .toLowerCase()
  .replace(/^@/, '');

export const schoolEmailDomain: string | null = rawDomain || null;
