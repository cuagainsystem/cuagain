export type NotificationPreferences = {
  emailUpdates: boolean;
  emailMessages: boolean;
};

export const DEFAULT_PREFERENCES: NotificationPreferences = { emailUpdates: true, emailMessages: false };

export type Conversation = {
  id: string;
  reportId: string | null;
  otherUserId: string;
  otherUsername: string;
  lastMessage: string | null;
  lastMessageAt: string;
  lastSenderId: string | null;
  unreadCount: number;
  iBlocked: boolean;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type MessageRequest = {
  id: string;
  requesterId: string;
  recipientId: string;
  otherUsername: string;
  reportId: string | null;
  reportTitle: string | null;
  introMessage: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};

export type CommunityMessage = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type AbuseKind = 'community_message' | 'private_message' | 'user';
export type AbuseReason = 'spam' | 'harassment' | 'inappropriate' | 'scam' | 'other';

export const ABUSE_REASONS: { value: AbuseReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'other', label: 'Something else' },
];

export type AbuseReportItem = {
  id: string;
  kind: AbuseKind;
  reason: AbuseReason;
  details: string | null;
  snapshot: string | null;
  status: 'open' | 'dismissed' | 'actioned';
  reporterName: string;
  targetName: string;
  targetId: string;
  handledNote: string | null;
  createdAt: string;
};

export const MESSAGE_LIMITS = { private: 2000, community: 500, request: 500 } as const;
