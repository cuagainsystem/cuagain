import { supabase } from './supabaseClient';

/*
  Listens for changes to one table and calls `onChange` (no details needed: screens simply
  reload). Returns a function that stops listening. Realtime can be unavailable or drop, so
  every screen that uses this also polls on a timer. Realtime only makes things faster.
*/
export function subscribeToTable(name: string, table: string, onChange: () => void, filter?: string): () => void {
  const client = supabase;
  if (!client) return () => undefined;

  try {
    const channel = client
      .channel(name)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => onChange())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  } catch {
    return () => undefined;
  }
}
