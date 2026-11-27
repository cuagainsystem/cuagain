import { useAuth } from '../../hooks/useAuth';
import { FormNotice } from '../common/FormNotice';

/** Shown on auth pages until Supabase keys are added, so the page never fails silently. */
export function NotConfiguredNotice() {
  const { isConfigured } = useAuth();
  if (isConfigured) return null;

  return (
    <FormNotice tone="warning" title="Supabase is not connected yet">
      Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code>, then
      restart the dev server. The form below cannot sign anyone in until then.
    </FormNotice>
  );
}
