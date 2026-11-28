import { useState } from 'react';
import { Flag } from 'lucide-react';
import { reportAbuse } from '../../services/messageService';
import { ABUSE_REASONS, type AbuseKind, type AbuseReason } from '../../types/communication';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';
import { FormNotice } from '../common/FormNotice';
import { TextAreaField } from '../forms/TextAreaField';
import styles from './Communication.module.css';

type ReportAbuseDialogProps = {
  open: boolean;
  onClose: () => void;
  kind: AbuseKind;
  targetId: string;
  /** What is being reported, shown so the person is sure: a quoted message or a username. */
  quote?: string;
  title: string;
};

/*
  The parent gives this a new `key` each time it opens for a different target, so the
  form always starts empty and a "sent" notice never carries over.
*/
export function ReportAbuseDialog({ open, onClose, kind, targetId, quote, title }: ReportAbuseDialogProps) {
  const [reason, setReason] = useState<AbuseReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!reason) {
      setError('Choose a reason first.');
      return;
    }
    setSending(true);
    setError(null);
    const result = await reportAbuse(kind, targetId, reason, details);
    setSending(false);
    if (result.ok) setSent(true);
    else setError(result.message);
  }

  return (
    <Dialog
      open={open}
      onClose={() => (sending ? undefined : onClose())}
      title={title}
      description="An administrator will look at this. The person is not told who reported them."
      footer={
        sent ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button leadingIcon={Flag} onClick={submit} loading={sending}>
              Send report
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <FormNotice tone="success">Thank you. Your report was sent to the administrators.</FormNotice>
      ) : (
        <div className={styles.dialogStack}>
          {quote ? <p className={styles.quote}>{quote}</p> : null}
          <fieldset className={styles.reasons}>
            <legend>Why are you reporting this?</legend>
            {ABUSE_REASONS.map((item) => (
              <label key={item.value} className={styles.reason} data-checked={reason === item.value}>
                <input type="radio" name="abuse-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} />
                <span>{item.label}</span>
              </label>
            ))}
          </fieldset>
          <TextAreaField label="More details (optional)" value={details} maxLength={500} rows={3} onChange={(event) => setDetails(event.target.value)} />
          {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        </div>
      )}
    </Dialog>
  );
}
