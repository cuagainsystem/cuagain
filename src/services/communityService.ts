import type { AbuseReportItem, AbuseKind, AbuseReason, CommunityMessage } from '../types/communication';
import { friendlyError } from './dbError';
import { failure, GENERIC_FAILURE, NOT_CONFIGURED, success, type Result } from './result';
import { supabase } from './supabaseClient';

type Row = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: { username: string } | null;
};

export async function listCommunityMessages(): Promise<Result<CommunityMessage[]>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase
      .from('community_messages')
      .select('id, author_id, body, created_at, author:profiles!community_messages_author_id_fkey(username)')
      .eq('is_removed', false)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return GENERIC_FAILURE;
    const rows = (data ?? []) as unknown as Row[];
    return success(
      rows.reverse().map((r) => ({
        id: r.id,
        authorId: r.author_id,
        authorName: r.author?.username ?? 'A user',
        body: r.body,
        createdAt: r.created_at,
      })),
    );
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function postCommunityMessage(userId: string, body: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  const text = body.trim();
  if (!text) return failure('Write a message first.');
  try {
    const { error } = await supabase.from('community_messages').insert({ author_id: userId, body: text });
    if (error) return friendlyError(error, 'The message could not be sent. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function removeCommunityMessage(messageId: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.rpc('admin_remove_community_message', { p_message_id: messageId });
    if (error) return friendlyError(error, 'Could not remove the message. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

// ---------- Abuse reports (administrators) ----------

type AbuseRow = {
  id: string;
  kind: AbuseKind;
  reason: AbuseReason;
  details: string | null;
  snapshot: string | null;
  status: AbuseReportItem['status'];
  target_user_id: string;
  handled_note: string | null;
  created_at: string;
  reporter: { username: string } | null;
  target: { username: string } | null;
};

export async function listAbuseReports(status: 'open' | 'handled'): Promise<Result<AbuseReportItem[]>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    let query = supabase
      .from('abuse_reports')
      .select(
        'id, kind, reason, details, snapshot, status, target_user_id, handled_note, created_at, reporter:profiles!abuse_reports_reporter_id_fkey(username), target:profiles!abuse_reports_target_user_id_fkey(username)',
      )
      .order('created_at', { ascending: false })
      .limit(100);
    query = status === 'open' ? query.eq('status', 'open') : query.neq('status', 'open');
    const { data, error } = await query;
    if (error) return GENERIC_FAILURE;
    return success(
      ((data ?? []) as unknown as AbuseRow[]).map((r) => ({
        id: r.id,
        kind: r.kind,
        reason: r.reason,
        details: r.details,
        snapshot: r.snapshot,
        status: r.status,
        reporterName: r.reporter?.username ?? 'A user',
        targetName: r.target?.username ?? 'A user',
        targetId: r.target_user_id,
        handledNote: r.handled_note,
        createdAt: r.created_at,
      })),
    );
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function resolveAbuseReport(id: string, outcome: 'dismissed' | 'actioned', note: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.rpc('admin_resolve_abuse_report', { p_report_id: id, p_status: outcome, p_note: note.trim() || null });
    if (error) return friendlyError(error, 'Could not save the outcome. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

/** When the newest message from someone else was posted, for the "new messages" dot. Null when unknown. */
export async function getLatestCommunityActivity(userId: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('community_messages')
      .select('created_at')
      .eq('is_removed', false)
      .neq('author_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return null;
    return ((data ?? [])[0] as { created_at: string } | undefined)?.created_at ?? null;
  } catch {
    return null;
  }
}
