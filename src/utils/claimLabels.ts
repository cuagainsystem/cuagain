import type { ClaimStatus } from '../services/dashboardService';
import type { BadgeTone } from '../types/ui';

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  pending: 'Pending',
  under_review: 'Under review',
  more_info_required: 'More information required',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const CLAIM_STATUS_TONES: Record<ClaimStatus, BadgeTone> = {
  pending: 'warning',
  under_review: 'info',
  more_info_required: 'warning',
  approved: 'success',
  rejected: 'neutral',
  completed: 'neutral',
  cancelled: 'neutral',
};
