import { format, isValid, parseISO } from 'date-fns';

/** Formats an ISO date as "Nov 26, 2026". Returns an em dash if the date is invalid. */
export function formatReportDate(isoDate: string): string {
  const parsed = parseISO(isoDate);
  return isValid(parsed) ? format(parsed, 'MMM d, yyyy') : '—';
}

/** Formats a timestamp as "Nov 26, 3:45 PM". Returns an em dash if it is invalid. */
export function formatTimestamp(isoTimestamp: string): string {
  const parsed = parseISO(isoTimestamp);
  return isValid(parsed) ? format(parsed, 'MMM d, h:mm a') : '—';
}
