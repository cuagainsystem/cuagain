import { useEffect, useId, useMemo, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import type { ReportPhoto } from '../../types/report';
import { ACCEPTED_IMAGE_TYPES, MAX_PHOTOS_PER_REPORT, validateImageFile } from '../../utils/imagePrep';
import { Button } from '../common/Button';
import styles from './PhotoPicker.module.css';

type PhotoPickerProps = {
  /** Photos already saved with the report (editing). */
  existing?: ReportPhoto[];
  /** Saved photos the user has marked for removal. They are deleted when the form is saved. */
  removedIds: string[];
  onToggleRemoved: (photoId: string) => void;
  /** New photos chosen but not uploaded yet. */
  files: File[];
  onFilesChange: (files: File[]) => void;
  /** Called with a message when a chosen file cannot be used. */
  onProblem: (message: string | null) => void;
  hint?: string;
  disabled?: boolean;
};

export function PhotoPicker({
  existing = [],
  removedIds,
  onToggleRemoved,
  files,
  onFilesChange,
  onProblem,
  hint,
  disabled,
}: PhotoPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const keptCount = existing.filter((photo) => !removedIds.includes(photo.id)).length;
  const remainingSlots = MAX_PHOTOS_PER_REPORT - keptCount - files.length;

  // Temporary local addresses so chosen photos can be previewed before upload.
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  function handleChosen(list: FileList | null) {
    if (!list || list.length === 0) return;

    const accepted: File[] = [];
    let problem: string | null = null;

    for (const file of Array.from(list)) {
      const message = validateImageFile(file);
      if (message) {
        problem = message;
      } else if (accepted.length < remainingSlots) {
        accepted.push(file);
      } else {
        problem = `You can add up to ${MAX_PHOTOS_PER_REPORT} photos to a report.`;
      }
    }

    onProblem(problem);
    if (accepted.length > 0) onFilesChange([...files, ...accepted]);
    // Lets the same file be picked again after removing it.
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <label htmlFor={inputId} className={styles.label}>
          Photos
          <span className={styles.optional}>Optional</span>
        </label>
        <p className={styles.count}>
          {keptCount + files.length} of {MAX_PHOTOS_PER_REPORT}
        </p>
      </div>

      <ul className={styles.grid}>
        {existing.map((photo) => {
          const removed = removedIds.includes(photo.id);
          return (
            <li key={photo.id} className={styles.tile} data-removed={removed}>
              {photo.url ? <img src={photo.url} alt="Saved item photo" /> : <span className={styles.missing}>Photo unavailable</span>}
              <button
                type="button"
                className={styles.remove}
                onClick={() => onToggleRemoved(photo.id)}
                aria-label={removed ? 'Keep this photo' : 'Remove this photo'}
                disabled={disabled}
              >
                {removed ? <span>Undo</span> : <X aria-hidden="true" />}
              </button>
              {removed ? <span className={styles.removedNote}>Will be removed</span> : null}
            </li>
          );
        })}

        {previews.map(({ file, url }, index) => (
          <li key={`${file.name}-${index}`} className={styles.tile}>
            <img src={url} alt={`New photo: ${file.name}`} />
            <button
              type="button"
              className={styles.remove}
              onClick={() => onFilesChange(files.filter((_, position) => position !== index))}
              aria-label={`Remove ${file.name}`}
              disabled={disabled}
            >
              <X aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        className="visually-hidden"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        multiple
        disabled={disabled || remainingSlots <= 0}
        onChange={(event) => handleChosen(event.target.files)}
      />

      <Button
        variant="secondary"
        leadingIcon={ImagePlus}
        disabled={disabled || remainingSlots <= 0}
        onClick={() => inputRef.current?.click()}
      >
        {remainingSlots <= 0 ? 'Photo limit reached' : 'Add photos'}
      </Button>

      <p className={styles.hint}>
        {hint ?? 'JPG, PNG or WebP. Photos are resized and stripped of hidden data such as your location before upload.'}
      </p>
    </div>
  );
}
