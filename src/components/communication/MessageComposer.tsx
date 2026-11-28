import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../common/Button';
import { FormNotice } from '../common/FormNotice';
import { TextAreaField } from '../forms/TextAreaField';
import styles from './Communication.module.css';

type MessageComposerProps = {
  label: string;
  placeholder?: string;
  maxLength: number;
  /** Returns an error message to show, or null when the message was sent. */
  onSend: (text: string) => Promise<string | null>;
};

/** Enter sends, Shift+Enter makes a new line. The text stays in the box if sending fails. */
export function MessageComposer({ label, placeholder, maxLength, onSend }: MessageComposerProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    const problem = await onSend(trimmed);
    setSending(false);
    if (problem) setError(problem);
    else setText('');
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      {error ? <FormNotice tone="error">{error}</FormNotice> : null}
      <div className={styles.composerRow}>
        <TextAreaField
          label={label}
          placeholder={placeholder}
          value={text}
          maxLength={maxLength}
          rows={2}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button type="submit" leadingIcon={Send} loading={sending} disabled={!text.trim()}>
          Send
        </Button>
      </div>
      <span className={styles.charCount}>
        {text.length} / {maxLength}
      </span>
    </form>
  );
}
