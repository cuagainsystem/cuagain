import { ExternalLink, FileText } from 'lucide-react';
import type { ClaimEvidenceFile } from '../../types/claim';
import styles from './Claims.module.css';

export function EvidenceList({ files }: { files: ClaimEvidenceFile[] }) {
  if (files.length === 0) return <p className={styles.muted}>No files were attached.</p>;

  return (
    <ul className={styles.evidenceGrid}>
      {files.map((file, index) => {
        const isImage = file.mimeType.startsWith('image/');
        const label = isImage ? `Evidence photo ${index + 1}` : `Evidence PDF ${index + 1}`;

        if (!file.url) {
          return (
            <li key={file.id} className={styles.evidenceTile}>
              <span className={styles.evidenceMissing}>File unavailable</span>
            </li>
          );
        }

        return (
          <li key={file.id} className={styles.evidenceTile}>
            <a href={file.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${label}`}>
              {isImage ? (
                <img src={file.url} alt={label} loading="lazy" />
              ) : (
                <span className={styles.evidencePdf}>
                  <FileText aria-hidden="true" />
                  <span>PDF</span>
                </span>
              )}
              <span className={styles.evidenceOpen}>
                <ExternalLink aria-hidden="true" />
                Open
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
