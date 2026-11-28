import type { ClaimEvent } from '../../types/claim';
import { CLAIM_STATUS_LABELS } from '../../utils/claimLabels';
import { formatTimestamp } from '../../utils/formatDate';
import styles from './Claims.module.css';

function describe(event: ClaimEvent): string {
  if (event.fromStatus === null) return 'Claim submitted';
  return CLAIM_STATUS_LABELS[event.toStatus];
}

export function ClaimTimeline({ events }: { events: ClaimEvent[] }) {
  return (
    <ol className={styles.timeline}>
      {events.map((event) => (
        <li key={event.id} className={styles.timelineItem}>
          <span className={styles.timelineDot} aria-hidden="true" />
          <div className={styles.timelineBody}>
            <p className={styles.timelineTitle}>{describe(event)}</p>
            <p className={styles.timelineMeta}>
              {formatTimestamp(event.createdAt)}
              {event.actorName ? ` · ${event.actorName}` : ''}
            </p>
            {event.note ? <p className={styles.timelineNote}>{event.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
