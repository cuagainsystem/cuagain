import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Mail, Trash2 } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { CheckboxField } from '../../components/forms/CheckboxField';
import styles from '../../components/communication/Communication.module.css';
import { useAuth } from '../../hooks/useAuth';
import { useLiveResource } from '../../hooks/useLiveResource';
import { useResource } from '../../hooks/useResource';
import { refreshUnreadCounts } from '../../hooks/useUnreadCounts';
import {
  deleteNotification,
  listNotifications,
  loadPreferences,
  markAllNotificationsRead,
  markNotificationRead,
  savePreferences,
} from '../../services/notificationService';
import { DEFAULT_PREFERENCES, type NotificationPreferences } from '../../types/communication';
import { formatTimestamp } from '../../utils/formatDate';

const LIVE = [{ table: 'notifications' }] as const;

function Preferences({ userId }: { userId: string }) {
  const load = useCallback(() => loadPreferences(userId), [userId]);
  const { result } = useResource(load);
  // What the person has changed on this screen wins over what was loaded.
  const [edited, setEdited] = useState<NotificationPreferences | null>(null);
  const prefs = edited ?? (result && result.ok ? result.data : DEFAULT_PREFERENCES);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  async function change(next: NotificationPreferences) {
    const before = edited;
    setEdited(next);
    setMessage(null);
    const saved = await savePreferences(userId, next);
    if (saved.ok) setMessage({ tone: 'success', text: 'Saved.' });
    else {
      setEdited(before);
      setMessage({ tone: 'error', text: saved.message });
    }
  }

  return (
    <section className={styles.card} aria-labelledby="email-settings">
      <h2 id="email-settings" className={styles.cardTitle}>
        Email settings
      </h2>
      <p className={styles.muted}>
        You always get these alerts here in the app. These switches only decide whether you also get an email.
      </p>
      <div className={styles.toggleList}>
        <CheckboxField
          label="Email me about my reports and claims"
          checked={prefs.emailUpdates}
          disabled={result === null}
          onChange={(event) => void change({ ...prefs, emailUpdates: event.target.checked })}
        />
        <CheckboxField
          label="Email me about new messages and message requests"
          checked={prefs.emailMessages}
          disabled={result === null}
          onChange={(event) => void change({ ...prefs, emailMessages: event.target.checked })}
        />
      </div>
      {result && !result.ok ? <FormNotice tone="error">{result.message}</FormNotice> : null}
      {message ? <FormNotice tone={message.tone}>{message.text}</FormNotice> : null}
    </section>
  );
}

export function NotificationsPage() {
  const { user } = useAuth();
  const { result, reload } = useLiveResource(listNotifications, LIVE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unread = result && result.ok ? result.data.filter((item) => !item.isRead).length : 0;

  async function afterChange(outcome: { ok: boolean; message?: string }) {
    if (!outcome.ok) setError(outcome.message ?? 'Something went wrong. Please try again.');
    reload();
    refreshUnreadCounts();
  }

  async function readAll() {
    setBusy(true);
    setError(null);
    await afterChange(await markAllNotificationsRead());
    setBusy(false);
  }

  async function open(id: string, isRead: boolean) {
    if (isRead) return;
    await markNotificationRead(id);
    refreshUnreadCounts();
  }

  async function remove(id: string) {
    setError(null);
    await afterChange(await deleteNotification(id));
  }

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Notifications</h1>
          <p className={styles.lead}>Updates about your reports, claims and messages.</p>
        </div>
        <Button variant="secondary" leadingIcon={CheckCheck} onClick={readAll} disabled={unread === 0} loading={busy}>
          Mark all as read
        </Button>
      </header>

      {error ? <FormNotice tone="error">{error}</FormNotice> : null}

      {result === null ? (
        <PageLoader label="Loading notifications" />
      ) : !result.ok ? (
        <EmptyState tone="error" title="We could not load your notifications" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.message}
        </EmptyState>
      ) : result.data.length === 0 ? (
        <EmptyState icon={Bell} title="Nothing yet">
          When something happens with your reports, claims or messages, it shows up here.
        </EmptyState>
      ) : (
        <ul className={styles.rows}>
          {result.data.map((item) => {
            const target = item.link && item.link.startsWith('/') ? item.link : null;
            const content = (
              <span className={styles.rowMain}>
                <span className={styles.rowTitle}>{item.title}</span>
                {item.body ? <span className={styles.rowTextWrap}>{item.body}</span> : null}
                <span className={styles.rowMeta}>
                  {formatTimestamp(item.createdAt)}
                  {item.isRead ? '' : ' · Unread'}
                </span>
              </span>
            );
            return (
              <li key={item.id}>
                <div className={styles.row} data-unread={!item.isRead}>
                  {item.isRead ? null : <span className={styles.dot} aria-hidden="true" />}
                  {target ? (
                    <Link to={target} onClick={() => void open(item.id, item.isRead)} style={{ flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none' }}>
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                  <Button variant="ghost" size="sm" leadingIcon={Trash2} onClick={() => void remove(item.id)} aria-label={`Delete notification: ${item.title}`}>
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {user ? <Preferences userId={user.id} /> : null}

      <p className={styles.muted}>
        <Mail aria-hidden="true" style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 6 }} />
        Emails never contain private message text.
      </p>
    </div>
  );
}
