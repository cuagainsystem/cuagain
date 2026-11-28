export type ClaimStatus =
  | 'pending'
  | 'under_review'
  | 'more_info_required'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

/** Claims that still need somebody to act: the administrator or the claimant. */
export const LIVE_CLAIM_STATUSES: readonly ClaimStatus[] = ['pending', 'under_review', 'more_info_required', 'approved'];

/** What an administrator can decide. Completing a handover is a separate action. */
export type ReviewDecision = 'under_review' | 'more_info_required' | 'approved' | 'rejected';

export type ClaimSummary = {
  id: string;
  reportId: string;
  reportTitle: string;
  reportStatus: string;
  status: ClaimStatus;
  createdAt: string;
  /** Only filled in for administrators. */
  claimantName?: string;
};

export type Claim = ClaimSummary & {
  claimantId: string;
  explanation: string;
  decisionNote: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
};

export type ClaimEvent = {
  id: string;
  actorName: string | null;
  fromStatus: ClaimStatus | null;
  toStatus: ClaimStatus;
  note: string | null;
  createdAt: string;
};

export type ClaimEvidenceFile = {
  id: string;
  path: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url?: string;
};

export type ClaimedItem = {
  id: string;
  title: string;
  categorySlug: string;
  location: string;
  occurredOn: string;
  handedToOffice: boolean;
  description: string;
  identifyingCharacteristics: string;
};

export type ClaimDetail = {
  claim: Claim;
  item: ClaimedItem;
  events: ClaimEvent[];
  evidence: ClaimEvidenceFile[];
  /** Only filled in for administrators. */
  claimantStudentId?: string;
  claimantRole?: string;
};
