import type { ReportStatus } from '../../types/report';
import { REPORT_STATUS_LABELS, REPORT_STATUS_TONES } from '../../utils/reportLabels';
import { Badge } from './Badge';

export function StatusBadge({ status }: { status: ReportStatus }) {
  return <Badge tone={REPORT_STATUS_TONES[status]}>{REPORT_STATUS_LABELS[status]}</Badge>;
}
