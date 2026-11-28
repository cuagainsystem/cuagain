import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, Flag, Undo2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { MessageComposer } from '../../components/communication/MessageComposer';
import { ReportAbuseDialog } from '../../components/communication/ReportAbuseDialog';
import { UserDot } from '../../components/communication/UserDot';
import { Dialog } from '../../components/common/Dialog';
import styles from '../../components/communication/Communication.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useLiveResource } from '../../hooks/useLiveResource';
import { refreshUnreadCounts } from '../../hooks/useUnreadCounts';
import { blockUser, getConversation, listMessages, markConversationRead, sendMessage, unblockUser } from '../../services/messageService';
import { failure, success, type Result } from '../../services/result';
import { MESSAGE_LIMITS, type ChatMessage, type Conversation } from '../../types/communication';
import { formatTimestamp } from '../../utils/formatDate';
import { reportRoutes, ROUTES } from '../../utils/routes';

const LIVE = [{ table: 'messages' }] as const;

type Loaded = { conversation: Conversation; messages: ChatMessage[] } | null;

type ReportTarget = { kind: 'private_message' | 'user'; id: string; quote?: string; key: string };

export function ConversationPage() {
  const { conversationId = '' } = useParams();
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const load = useCallback(async (): Promise<Result<Loaded>> => {
    const [conversation, messages] = await Promise.all([getConversation(conversationId), listMessages(conversationId)]);
    if (!conversation.ok) return failure(conversation.message);
    if (!conversation.data) return success(null);
    if (!messages.ok) return failure(messages.message);
    return success({ conversation: conversation.data, messages: messages.data });
  }, [conversationId]);
  const { result, reload } = useLiveResource(load, LIVE, 6000);

  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const loaded = result && result.ok ? result.data : null;
  const unread = loaded?.conversation.unreadCount ?? 0;
  const messageCount = loaded?.messages.length ?? 0;

  // Opening the conversation, or receiving a message while it is open, counts as reading it.
  useEffect(() => {
    if (!userId || unread === 0) return;
    void markConversationRead(conversationId, userId).then(refreshUnreadCounts);
  }, [conversationId, userId, unread]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messageCount]);

  async function send(text: string): Promise<string | null> {
    const outcome = await sendMessage(conversationId, userId, text);
    if (!outcome.ok) return outcome.message;
    reload();
    return null;
  }

  async function toggleBlock(conversation: Conversation) {
    setBlocking(true);
    setActionError(null);
    const outcome = conversation.iBlocked ? await unblockUser(userId, conversation.otherUserId) : await blockUser(userId, conversation.otherUserId);
    setBlocking(false);
    setBlockOpen(false);
    if (!outcome.ok) setActionError(outcome.message);
    reload();
  }

  function openReport(next: Omit<ReportTarget, 'key'>) {
    setTarget({ ...next, key: `${next.kind}-${next.id}-${Date.now()}` });
    setReportOpen(true);
  }

  if (result === null) return <div className={`container ${styles.page}`}><PageLoader label="Loading conversation" /></div>;

  if (!result.ok) {
    return (
      <div className={`container ${styles.page}`}>
        <EmptyState tone="error" title="We could not load this conversation" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.message}
        </EmptyState>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className={`container ${styles.page}`}>
        <EmptyState title="Conversation not found" action={<ButtonLink to={ROUTES.messages}>Back to messages</ButtonLink>}>
          It may not exist, or it may belong to someone else.
        </EmptyState>
      </div>
    );
  }

  const { conversation, messages } = loaded;

  return (
    <div className={`container ${styles.page}`}>
      <Link to={ROUTES.messages} className={`${styles.linkButton} ${styles.back}`}>
        <ArrowLeft aria-hidden="true" />
        All messages
      </Link>

      <header className={styles.header}>
        <div className={styles.requestHead}>
          <UserDot name={conversation.otherUsername} />
          <div className={styles.headerText}>
            <h1 className={styles.title} style={{ fontSize: 'var(--text-2xl)' }}>
              {conversation.otherUsername}
            </h1>
            {conversation.reportId ? (
              <Link to={reportRoutes.detail(conversation.reportId)} className={styles.muted}>
                About an item. View it
              </Link>
            ) : null}
          </div>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" leadingIcon={Flag} onClick={() => openReport({ kind: 'user', id: conversation.otherUserId })}>
            Report
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={conversation.iBlocked ? Undo2 : Ban}
            onClick={() => (conversation.iBlocked ? void toggleBlock(conversation) : setBlockOpen(true))}
            loading={blocking && conversation.iBlocked}
          >
            {conversation.iBlocked ? 'Unblock' : 'Block'}
          </Button>
        </div>
      </header>

      {actionError ? <FormNotice tone="error">{actionError}</FormNotice> : null}

      <div className={styles.chat}>
        <div className={styles.thread} role="log" aria-label={`Conversation with ${conversation.otherUsername}`} aria-live="polite">
          {messages.length === 0 ? <p className={styles.empty}>No messages yet. Say hello.</p> : null}
          {messages.map((message) => {
            const mine = message.senderId === userId;
            return (
              <div key={message.id} className={styles.bubbleRow} data-mine={mine}>
                {mine ? null : <UserDot name={conversation.otherUsername} size="sm" />}
                <div className={styles.bubbleWrap}>
                  <p className={styles.bubble}>{message.body}</p>
                  <span className={styles.bubbleMeta}>
                    {formatTimestamp(message.createdAt)}
                    {mine ? null : (
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => openReport({ kind: 'private_message', id: message.id, quote: message.body })}
                        aria-label={`Report this message from ${conversation.otherUsername}`}
                      >
                        <Flag aria-hidden="true" />
                        Report
                      </button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {conversation.iBlocked ? (
          <FormNotice tone="info">You blocked this person. Unblock them to send messages again.</FormNotice>
        ) : (
          <MessageComposer label="Your message" placeholder="Write a message" maxLength={MESSAGE_LIMITS.private} onSend={send} />
        )}
      </div>

      <Dialog
        open={blockOpen}
        onClose={() => (blocking ? undefined : setBlockOpen(false))}
        title={`Block ${conversation.otherUsername}?`}
        description="They will not be able to send you messages or message requests. You can unblock them any time from this page."
        footer={
          <>
            <Button variant="ghost" onClick={() => setBlockOpen(false)} disabled={blocking}>
              Cancel
            </Button>
            <Button leadingIcon={Ban} onClick={() => void toggleBlock(conversation)} loading={blocking}>
              Block
            </Button>
          </>
        }
      />

      {target ? (
        <ReportAbuseDialog
          key={target.key}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          kind={target.kind}
          targetId={target.id}
          quote={target.quote}
          title={target.kind === 'user' ? `Report ${conversation.otherUsername}` : 'Report this message'}
        />
      ) : null}
    </div>
  );
}
