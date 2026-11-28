import { useState } from 'react';
import { Send } from 'lucide-react';
import { sendMessageRequest } from '../../services/messageService';
import { MESSAGE_LIMITS } from '../../types/communication';
import { Button } from '../common/Button';
import { Dialog } from '../common/Dialog';
import { FormNotice } from '../common/FormNotice';
import { TextAreaField } from '../forms/TextAreaField';
import styles from './Communication.module.css';

type RequestMessageDialogProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  recipientId: string;
  recipientName: string;
  reportId: string;
};

export function RequestMessageDialog({ open, onClose, userId, recipientId, recipientName, reportId }: RequestMessageDialogProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setSending(true);
    setError(null);
    const outcome = await sendMessageRequest(userId, recipientId, reportId, text);
    setSending(false);
    if (outcome.ok) setSent(true);
    else setError(outcome.message);
  }

  return (
    <Dialog
      open={open}
      onClose={() => (sending ? undefined : onClose())}
      title={`Message ${recipientName}`}
      description="They will see a short request first. You can chat once they accept."
      footer={
        sent ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button leadingIcon={Send} onClick={submit} loading={sending} disabled={!text.trim()}>
              Send request
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <FormNotice tone="success">Request sent. You will get a notification when {recipientName} answers.</FormNotice>
      ) : (
        <div className={styles.dialogStack}>
          <TextAreaField
            label="Your first message"
            hint="Say who you are and what this is about. Do not share phone numbers or other private details."
            value={text}
            maxLength={MESSAGE_LIMITS.request}
            rows={4}
            onChange={(event) => setText(event.target.value)}
          />
          {error ? <FormNotice tone="error">{error}</FormNotice> : null}
        </div>
      )}
    </Dialog>
  );
}
