import type { ClaimStatus } from '../../types/claim';
import { CLAIM_STATUS_LABELS, CLAIM_STATUS_TONES } from '../../utils/claimLabels';
import { Badge } from '../common/Badge';

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return <Badge tone={CLAIM_STATUS_TONES[status]}>{CLAIM_STATUS_LABELS[status]}</Badge>;
}
