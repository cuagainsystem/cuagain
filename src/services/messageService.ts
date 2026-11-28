import type { AbuseKind, AbuseReason, ChatMessage, Conversation, MessageRequest } from '../types/communication';
import { friendlyError } from './dbError';
import { failure, GENERIC_FAILURE, NOT_CONFIGURED, success, type Result } from './result';
import { supabase } from './supabaseClient';

type ConversationRow = {
  conversation_id: string;
  report_id: string | null;
  other_user_id: string;
  other_username: string;
  last_message: string | null;
  last_message_at: string;
  last_sender_id: string | null;
  unread_count: number;
  i_blocked: boolean;
};

function toConversation(row: ConversationRow): Conversation {
  return {
    id: row.conversation_id,
    reportId: row.report_id,
    otherUserId: row.other_user_id,
    otherUsername: row.other_username,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    lastSenderId: row.last_sender_id,
    unreadCount: row.unread_count,
    iBlocked: row.i_blocked,
  };
}

export async function listConversations(): Promise<Result<Conversation[]>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase.rpc('list_my_conversations');
    if (error) return GENERIC_FAILURE;
    return success(((data ?? []) as ConversationRow[]).map(toConversation));
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function countUnreadMessages(): Promise<number> {
  const result = await listConversations();
  return result.ok ? result.data.reduce((sum, c) => sum + c.unreadCount, 0) : 0;
}

type RequestRow = {
  id: string;
  requester_id: string;
  recipient_id: string;
  report_id: string | null;
  intro_message: string;
  status: MessageRequest['status'];
  created_at: string;
  requester: { username: string } | null;
  recipient: { username: string } | null;
  reports: { title: string } | null;
};

export type RequestLists = { incoming: MessageRequest[]; outgoing: MessageRequest[] };

export async function listRequests(userId: string): Promise<Result<RequestLists>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase
      .from('message_requests')
      .select(
        'id, requester_id, recipient_id, report_id, intro_message, status, created_at, requester:profiles!message_requests_requester_id_fkey(username), recipient:profiles!message_requests_recipient_id_fkey(username), reports(title)',
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return GENERIC_FAILURE;

    const lists: RequestLists = { incoming: [], outgoing: [] };
    for (const row of (data ?? []) as unknown as RequestRow[]) {
      const mine = row.requester_id === userId;
      const item: MessageRequest = {
        id: row.id,
        requesterId: row.requester_id,
        recipientId: row.recipient_id,
        otherUsername: (mine ? row.recipient?.username : row.requester?.username) ?? 'A user',
        reportId: row.report_id,
        reportTitle: row.reports?.title ?? null,
        introMessage: row.intro_message,
        status: row.status,
        createdAt: row.created_at,
      };
      (mine ? lists.outgoing : lists.incoming).push(item);
    }
    return success(lists);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function sendMessageRequest(
  userId: string,
  recipientId: string,
  reportId: string | null,
  intro: string,
): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  const text = intro.trim();
  if (!text) return failure('Write a short message first.');
  try {
    const { error } = await supabase
      .from('message_requests')
      .insert({ requester_id: userId, recipient_id: recipientId, report_id: reportId, intro_message: text });
    if (error) {
      if (error.code === '23505') return failure('You already have a request waiting for this person.');
      return friendlyError(error, 'The request could not be sent. Please try again.');
    }
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

/** Returns the new conversation id when accepted, or null when declined. */
export async function respondToRequest(requestId: string, accept: boolean): Promise<Result<string | null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase.rpc('respond_to_message_request', { p_request_id: requestId, p_accept: accept });
    if (error) return friendlyError(error, 'Could not answer the request. Please try again.');
    return success((data as string | null) ?? null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function getConversation(conversationId: string): Promise<Result<Conversation | null>> {
  const result = await listConversations();
  if (!result.ok) return result;
  return success(result.data.find((c) => c.id === conversationId) ?? null);
}

export async function listMessages(conversationId: string): Promise<Result<ChatMessage[]>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, body, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return GENERIC_FAILURE;
    const rows = (data ?? []) as { id: string; sender_id: string; body: string; created_at: string }[];
    return success(rows.reverse().map((r) => ({ id: r.id, senderId: r.sender_id, body: r.body, createdAt: r.created_at })));
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function sendMessage(conversationId: string, userId: string, body: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  const text = body.trim();
  if (!text) return failure('Write a message first.');
  try {
    const { error } = await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, body: text });
    if (error) return friendlyError(error, 'The message could not be sent. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

/** Clears the unread count and the matching alert. Failing quietly is fine: it only affects counters. */
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('type', 'new_message')
      .eq('link', `/messages/${conversationId}`)
      .eq('is_read', false);
  } catch {
    // Nothing to do.
  }
}

export async function blockUser(userId: string, otherId: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.from('user_blocks').insert({ blocker_id: userId, blocked_id: otherId });
    if (error && error.code !== '23505') return friendlyError(error, 'Could not block this person. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function unblockUser(userId: string, otherId: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', otherId);
    return error ? GENERIC_FAILURE : success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function listBlockedIds(userId: string): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('user_blocks').select('blocked_id').eq('blocker_id', userId);
    return error ? [] : ((data ?? []) as { blocked_id: string }[]).map((r) => r.blocked_id);
  } catch {
    return [];
  }
}

export async function reportAbuse(kind: AbuseKind, targetId: string, reason: AbuseReason, details: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.rpc('report_abuse', {
      p_kind: kind,
      p_target_id: targetId,
      p_reason: reason,
      p_details: details.trim() || null,
    });
    if (error) return friendlyError(error, 'The report could not be sent. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}
