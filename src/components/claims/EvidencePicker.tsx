import { useId, useRef } from 'react';
import { FileText, ImageIcon, Paperclip, X } from 'lucide-react';
import { EVIDENCE_ACCEPT, isPdf, MAX_EVIDENCE_FILES, validateEvidenceFile } from '../../utils/evidencePrep';
import { Button } from '../common/Button';
import styles from './Claims.module.css';

type EvidencePickerProps = {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onProblem: (message: string | null) => void;
  /** Files already attached to this claim count towards the limit. */
  alreadyAttached?: number;
  disabled?: boolean;
};

function readableSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function EvidencePicker({ files, onFilesChange, onProblem, alreadyAttached = 0, disabled }: EvidencePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = MAX_EVIDENCE_FILES - alreadyAttached - files.length;

  function handleChosen(list: FileList | null) {
    if (!list || list.length === 0) return;

    const accepted: File[] = [];
    let problem: string | null = null;

    for (const file of Array.from(list)) {
      const message = validateEvidenceFile(file);
      if (message) problem = message;
      else if (accepted.length < remaining) accepted.push(file);
      else problem = `You can attach up to ${MAX_EVIDENCE_FILES} files to a claim.`;
    }

    onProblem(problem);
    if (accepted.length > 0) onFilesChange([...files, ...accepted]);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className={styles.picker}>
      <div className={styles.pickerHeader}>
        <label htmlFor={inputId} className={styles.pickerLabel}>
          Proof of ownership
          <span className={styles.optional}>Optional</span>
        </label>
        <p className={styles.count}>
          {alreadyAttached + files.length} of {MAX_EVIDENCE_FILES}
        </p>
      </div>

      {files.length > 0 ? (
        <ul className={styles.fileList}>
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className={styles.fileRow}>
              {isPdf(file) ? <FileText aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.fileSize}>{readableSize(file.size)}</span>
              <button
                type="button"
                className={styles.fileRemove}
                onClick={() => onFilesChange(files.filter((_, position) => position !== index))}
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
              >
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="visually-hidden"
        accept={EVIDENCE_ACCEPT}
        multiple
        disabled={disabled || remaining <= 0}
        onChange={(event) => handleChosen(event.target.files)}
      />

      <Button
        variant="secondary"
        leadingIcon={Paperclip}
        disabled={disabled || remaining <= 0}
        onClick={() => inputRef.current?.click()}
      >
        {remaining <= 0 ? 'File limit reached' : 'Attach files'}
      </Button>

      <p className={styles.hint}>
        Photos of the item from before it was lost, receipts or screenshots. JPG, PNG, WebP or PDF. Only you and the
        administrators can open these files.
      </p>
    </div>
  );
}
