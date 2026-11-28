import { useCallback, useState } from 'react';
import { Check, Flag, X } from 'lucide-react';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Dialog } from '../../components/common/Dialog';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { TextAreaField } from '../../components/forms/TextAreaField';
import styles from '../../components/communication/Communication.module.css';
import { useLiveResource } from '../../hooks/useLiveResource';
import { refreshUnreadCounts } from '../../hooks/useUnreadCounts';
import { listAbuseReports, resolveAbuseReport } from '../../services/communityService';
import { ABUSE_REASONS, type AbuseReportItem } from '../../types/communication';
import { formatTimestamp } from '../../utils/formatDate';

const LIVE = [{ table: 'abuse_reports' }] as const;
const KIND_LABEL = { community_message: 'Community message', private_message: 'Private message', user: 'Person' } as const;

export function AdminAbusePage() {
  const [tab, setTab] = useState<'open' | 'handled'>('open');
  const load = useCallback(() => listAbuseReports(tab), [tab]);
  const { result, reload } = useLiveResource(load, LIVE, 15000);

  const [selected, setSelected] = useState<{ report: AbuseReportItem; outcome: 'dismissed' | 'actioned' } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const outcome = await resolveAbuseReport(selected.report.id, selected.outcome, note);
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setSelected(null);
    setNote('');
    reload();
    refreshUnreadCounts();
  }

  function choose(report: AbuseReportItem, outcome: 'dismissed' | 'actioned') {
    setSelected({ report, outcome });
    setNote('');
    setError(null);
  }

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Abuse reports</h1>
          <p className={styles.lead}>Messages and people reported by users. Reported text is kept as it was when reported.</p>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="Report status">
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'open'} onClick={() => setTab('open')}>
          Open
        </button>
        <button type="button" role="tab" className={styles.tab} aria-selected={tab === 'handled'} onClick={() => setTab('handled')}>
          Handled
        </button>
      </div>

      {result === null ? (
        <PageLoader label="Loading reports" />
      ) : !result.ok ? (
        <EmptyState tone="error" title="We could not load the reports" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.message}
        </EmptyState>
      ) : result.data.length === 0 ? (
        <EmptyState icon={Flag} title={tab === 'open' ? 'No open reports' : 'Nothing handled yet'}>
          {tab === 'open' ? 'When someone reports a message or a person, it appears here.' : 'Reports you dismiss or act on are listed here.'}
        </EmptyState>
      ) : (
        <ul className={styles.rows}>
          {result.data.map((report) => (
            <li key={report.id} className={styles.requestRow}>
              <div className={styles.requestHead}>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {KIND_LABEL[report.kind]} from {report.targetName}
                  </span>
                  <span className={styles.rowMeta}>
                    Reported by {report.reporterName} · {formatTimestamp(report.createdAt)}
                  </span>
                </span>
                <Badge tone={report.status === 'open' ? 'warning' : report.status === 'actioned' ? 'success' : 'neutral'}>
                  {report.status === 'open' ? 'Open' : report.status === 'actioned' ? 'Action taken' : 'Dismissed'}
                </Badge>
              </div>
              <p className={styles.muted}>Reason: {ABUSE_REASONS.find((item) => item.value === report.reason)?.label ?? report.reason}</p>
              {report.snapshot ? <p className={styles.quote}>{report.snapshot}</p> : null}
              {report.details ? <p className={styles.rowTextWrap}>{report.details}</p> : null}
              {report.handledNote ? <p className={styles.muted}>Note: {report.handledNote}</p> : null}
              {report.status === 'open' ? (
                <div className={styles.actions}>
                  <Button leadingIcon={Check} onClick={() => choose(report, 'actioned')}>
                    Action taken
                  </Button>
                  <Button variant="secondary" leadingIcon={X} onClick={() => choose(report, 'dismissed')}>
                    Dismiss
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={selected !== null}
        onClose={() => (busy ? undefined : setSelected(null))}
        title={selected?.outcome === 'actioned' ? 'Mark action taken' : 'Dismiss this report'}
        description={
          selected?.outcome === 'actioned'
            ? 'Use this after you removed the content or dealt with the person. Add a note for the record.'
            : 'Use this when the report does not need any action.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={confirm} loading={busy}>
              Save outcome
            </Button>
          </>
        }
      >
        <div className={styles.dialogStack}>
          <TextAreaField label="Note (optional)" value={note} maxLength={500} rows={3} onChange={(event) => setNote(event.target.value)} />
          {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        </div>
      </Dialog>
    </div>
  );
}
