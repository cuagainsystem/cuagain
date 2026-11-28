import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Trash2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Dialog } from '../../components/common/Dialog';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { MessageComposer } from '../../components/communication/MessageComposer';
import { ReportAbuseDialog } from '../../components/communication/ReportAbuseDialog';
import { UserDot } from '../../components/communication/UserDot';
import styles from '../../components/communication/Communication.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useLiveResource } from '../../hooks/useLiveResource';
import { refreshUnreadCounts } from '../../hooks/useUnreadCounts';
import { listCommunityMessages, postCommunityMessage, removeCommunityMessage } from '../../services/communityService';
import { listBlockedIds } from '../../services/messageService';
import { failure, success, type Result } from '../../services/result';
import { isAdminRole } from '../../types/database';
import { MESSAGE_LIMITS, type CommunityMessage } from '../../types/communication';
import { markCommunitySeen } from '../../utils/communitySeen';
import { formatTimestamp } from '../../utils/formatDate';

const LIVE = [{ table: 'community_messages' }] as const;

type Loaded = { messages: CommunityMessage[]; blocked: string[] };

export function CommunityPage() {
  const { user, profile } = useAuth();
  const userId = user?.id ?? '';
  const isAdmin = isAdminRole(profile?.role);

  const load = useCallback(async (): Promise<Result<Loaded>> => {
    const [messages, blocked] = await Promise.all([listCommunityMessages(), listBlockedIds(userId)]);
    if (!messages.ok) return failure(messages.message);
    return success({ messages: messages.data, blocked });
  }, [userId]);
  const { result, reload } = useLiveResource(load, LIVE, 6000);

  const [reporting, setReporting] = useState<{ message: CommunityMessage; key: string } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [removing, setRemoving] = useState<CommunityMessage | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    if (!result || !result.ok) return [];
    const hidden = new Set(result.data.blocked);
    return result.data.messages.filter((message) => !hidden.has(message.authorId));
  }, [result]);

  const lastId = visible.length > 0 ? visible[visible.length - 1].id : null;

  // Being on this page counts as having seen the chat, so the dot in the menu clears.
  useEffect(() => {
    markCommunitySeen();
    refreshUnreadCounts();
  }, [lastId]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [lastId]);

  async function send(text: string): Promise<string | null> {
    const outcome = await postCommunityMessage(userId, text);
    if (!outcome.ok) return outcome.message;
    reload();
    return null;
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    setError(null);
    const outcome = await removeCommunityMessage(removing.id);
    setRemoveBusy(false);
    setRemoving(null);
    if (!outcome.ok) setError(outcome.message);
    reload();
  }

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Community</h1>
          <p className={styles.lead}>A shared space for Capitol University. Be kind, and never post private details such as phone numbers.</p>
        </div>
      </header>

      {error ? <FormNotice tone="error">{error}</FormNotice> : null}

      {result === null ? (
        <PageLoader label="Loading the community chat" />
      ) : !result.ok ? (
        <EmptyState tone="error" title="We could not load the chat" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.message}
        </EmptyState>
      ) : (
        <div className={styles.chat}>
          <div className={styles.thread} role="log" aria-label="Community messages" aria-live="polite">
            {visible.length === 0 ? <p className={styles.empty}>No messages yet. Start the conversation.</p> : null}
            {visible.map((message) => {
              const mine = message.authorId === userId;
              return (
                <div key={message.id} className={styles.bubbleRow} data-mine={mine}>
                  <UserDot name={message.authorName} size="sm" />
                  <div className={styles.bubbleWrap}>
                    <span className={styles.author}>{mine ? 'You' : message.authorName}</span>
                    <p className={styles.bubble}>{message.body}</p>
                    <span className={styles.bubbleMeta}>
                      {formatTimestamp(message.createdAt)}
                      {mine ? null : (
                        <button
                          type="button"
                          className={styles.linkButton}
                          onClick={() => {
                            setReporting({ message, key: `${message.id}-${Date.now()}` });
                            setReportOpen(true);
                          }}
                          aria-label={`Report this message from ${message.authorName}`}
                        >
                          <Flag aria-hidden="true" />
                          Report
                        </button>
                      )}
                      {isAdmin ? (
                        <button type="button" className={styles.linkButton} onClick={() => setRemoving(message)} aria-label={`Remove this message from ${message.authorName}`}>
                          <Trash2 aria-hidden="true" />
                          Remove
                        </button>
                      ) : null}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
          <MessageComposer label="Message the community" placeholder="Write a message" maxLength={MESSAGE_LIMITS.community} onSend={send} />
        </div>
      )}

      {reporting ? (
        <ReportAbuseDialog
          key={reporting.key}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          kind="community_message"
          targetId={reporting.message.id}
          quote={reporting.message.body}
          title="Report this message"
        />
      ) : null}

      <Dialog
        open={removing !== null}
        onClose={() => (removeBusy ? undefined : setRemoving(null))}
        title="Remove this message?"
        description="It disappears for everyone. This is recorded in the activity log."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)} disabled={removeBusy}>
              Keep it
            </Button>
            <Button leadingIcon={Trash2} onClick={confirmRemove} loading={removeBusy}>
              Remove
            </Button>
          </>
        }
      >
        {removing ? <p className={styles.quote}>{removing.body}</p> : null}
      </Dialog>
    </div>
  );
}
