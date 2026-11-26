import type { ReportStatus, ReportType } from '../types/report';
import type { BadgeTone } from '../types/ui';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  lost: 'Lost',
  found: 'Found',
};

export const REPORT_TYPE_TONES: Record<ReportType, BadgeTone> = {
  lost: 'primary',
  found: 'neutral',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  claimed: 'Claimed',
  completed: 'Completed',
};

export const REPORT_STATUS_TONES: Record<ReportStatus, BadgeTone> = {
  open: 'success',
  under_review: 'warning',
  claimed: 'info',
  completed: 'neutral',
};
