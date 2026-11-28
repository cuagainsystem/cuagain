import { DEFAULT_PREFERENCES, type NotificationPreferences } from '../types/communication';
import type { NotificationItem } from './dashboardService';
import { GENERIC_FAILURE, NOT_CONFIGURED, success, type Result } from './result';
import { supabase } from './supabaseClient';

type Row = { id: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string };

function toItem(row: Row): NotificationItem {
  return { id: row.id, title: row.title, body: row.body, link: row.link, isRead: row.is_read, createdAt: row.created_at };
}

export async function listNotifications(): Promise<Result<NotificationItem[]>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, link, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return GENERIC_FAILURE;
    return success((data as Row[]).map(toItem));
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function countUnreadNotifications(): Promise<number> {
  if (!supabase) return 0;
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    return error ? GENERIC_FAILURE : success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function markAllNotificationsRead(): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    return error ? GENERIC_FAILURE : success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function deleteNotification(id: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.from('notifications').delete().eq('id', id);
    return error ? GENERIC_FAILURE : success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function loadPreferences(userId: string): Promise<Result<NotificationPreferences>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('email_updates, email_messages')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return GENERIC_FAILURE;
    return success(
      data ? { emailUpdates: data.email_updates as boolean, emailMessages: data.email_messages as boolean } : DEFAULT_PREFERENCES,
    );
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function savePreferences(userId: string, prefs: NotificationPreferences): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, email_updates: prefs.emailUpdates, email_messages: prefs.emailMessages }, { onConflict: 'user_id' });
    return error ? GENERIC_FAILURE : success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}
