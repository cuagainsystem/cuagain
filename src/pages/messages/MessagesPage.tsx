import { useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronRight, Inbox, MessageCircle, X } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { CountBadge } from '../../components/communication/CountBadge';
import { UserDot } from '../../components/communication/UserDot';
import styles from '../../components/communication/Communication.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useLiveResource } from '../../hooks/useLiveResource';
import { refreshUnreadCounts } from '../../hooks/useUnreadCounts';
import { listConversations, listRequests, respondToRequest } from '../../services/messageService';
import { failure, success, type Result } from '../../services/result';
import type { Conversation } from '../../types/communication';
import { formatTimestamp } from '../../utils/formatDate';
import { messageRoutes, reportRoutes } from '../../utils/routes';

type Tab = 'conversations' | 'requests';
const LIVE = [{ table: 'messages' }, { table: 'message_requests' }, { table: 'conversations' }] as const;

export function MessagesPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'requests' ? 'requests' : 'conversations';

  const load = useCallback(async (): Promise<Result<{ conversations: Conversation[]; incoming: Awaited<ReturnType<typeof listRequests>> }>> => {
    const [conversations, requests] = await Promise.all([listConversations(), listRequests(userId)]);
    if (!conversations.ok) return failure(conversations.message);
    return success({ conversations: conversations.data, incoming: requests });
  }, [userId]);
  const { result, reload } = useLiveResource(load, LIVE);

  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function selectTab(next: Tab) {
    setParams(next === 'requests' ? { tab: 'requests' } : {}, { replace: true });
  }

  async function answer(requestId: string, accept: boolean) {
    setWorking(requestId);
    setError(null);
    const outcome = await respondToRequest(requestId, accept);
    setWorking(null);
    if (!outcome.ok) {
      setError(outcome.message);
      reload();
      return;
    }
    refreshUnreadCounts();
    if (accept && outcome.data) navigate(messageRoutes.thread(outcome.data));
    else reload();
  }

  const requests = result && result.ok && result.data.incoming.ok ? result.data.incoming.data : null;
  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Messages</h1>
          <p className={styles.lead}>Private conversations about lost and found items.</p>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Message folders">
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'conversations'} onClick={() => selectTab('conversations')}>
          Conversations
        </button>
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'requests'} onClick={() => selectTab('requests')}>
          Requests
          <CountBadge count={incoming.length} label="waiting requests" />
        </button>
      </div>

      {error ? <FormNotice tone="error">{error}</FormNotice> : null}

      {result === null ? (
        <PageLoader label="Loading messages" />
      ) : !result.ok ? (
        <EmptyState tone="error" title="We could not load your messages" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.message}
        </EmptyState>
      ) : tab === 'conversations' ? (
        result.data.conversations.length === 0 ? (
          <EmptyState icon={MessageCircle} title="No conversations yet">
            Open an item and choose &quot;Message&quot; to ask the person who posted it. They need to accept before you can chat.
          </EmptyState>
        ) : (
          <ul className={styles.rows}>
            {result.data.conversations.map((c) => (
              <li key={c.id}>
                <Link to={messageRoutes.thread(c.id)} className={styles.row} data-unread={c.unreadCount > 0}>
                  <UserDot name={c.otherUsername} />
                  <span className={styles.rowMain}>
                    <span className={styles.rowTitle}>{c.otherUsername}</span>
                    <span className={styles.rowText}>
                      {c.lastMessage ? `${c.lastSenderId === userId ? 'You: ' : ''}${c.lastMessage}` : 'No messages yet'}
                    </span>
                    <span className={styles.rowMeta}>{formatTimestamp(c.lastMessageAt)}</span>
                  </span>
                  <span className={styles.rowSide}>
                    <CountBadge count={c.unreadCount} label="unread messages" />
                    <ChevronRight aria-hidden="true" width={18} height={18} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : !result.data.incoming.ok ? (
        <EmptyState tone="error" title="We could not load your requests" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.data.incoming.message}
        </EmptyState>
      ) : incoming.length === 0 && outgoing.length === 0 ? (
        <EmptyState icon={Inbox} title="No requests waiting">
          When someone wants to message you, you will see their request here and can accept or decline it.
        </EmptyState>
      ) : (
        <>
          {incoming.length > 0 ? (
            <section aria-labelledby="incoming-heading" className={styles.dialogStack}>
              <h2 id="incoming-heading" className={styles.cardTitle}>
                Asking to message you
              </h2>
              <ul className={styles.rows}>
                {incoming.map((request) => (
                  <li key={request.id} className={styles.requestRow}>
                    <div className={styles.requestHead}>
                      <UserDot name={request.otherUsername} />
                      <span className={styles.rowMain}>
                        <span className={styles.rowTitle}>{request.otherUsername}</span>
                        <span className={styles.rowMeta}>
                          {formatTimestamp(request.createdAt)}
                          {request.reportTitle ? ` · About ${request.reportTitle}` : ''}
                        </span>
                      </span>
                    </div>
                    <p className={styles.requestBody}>{request.introMessage}</p>
                    <div className={styles.actions}>
                      <Button leadingIcon={Check} onClick={() => void answer(request.id, true)} loading={working === request.id}>
                        Accept
                      </Button>
                      <Button variant="secondary" leadingIcon={X} onClick={() => void answer(request.id, false)} disabled={working === request.id}>
                        Decline
                      </Button>
                      {request.reportId ? (
                        <Link to={reportRoutes.detail(request.reportId)} className={styles.linkButton}>
                          View the item
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {outgoing.length > 0 ? (
            <section aria-labelledby="outgoing-heading" className={styles.dialogStack}>
              <h2 id="outgoing-heading" className={styles.cardTitle}>
                Waiting for an answer
              </h2>
              <ul className={styles.rows}>
                {outgoing.map((request) => (
                  <li key={request.id} className={styles.row}>
                    <UserDot name={request.otherUsername} />
                    <span className={styles.rowMain}>
                      <span className={styles.rowTitle}>{request.otherUsername}</span>
                      <span className={styles.rowText}>{request.introMessage}</span>
                      <span className={styles.rowMeta}>Sent {formatTimestamp(request.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
