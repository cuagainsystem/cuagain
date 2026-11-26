import { PackageCheck, SearchX } from 'lucide-react';
import type { ReportType } from '../../types/report';
import { REPORT_TYPE_LABELS, REPORT_TYPE_TONES } from '../../utils/reportLabels';
import { Badge } from './Badge';

export function ReportTypeBadge({ type }: { type: ReportType }) {
  return (
    <Badge tone={REPORT_TYPE_TONES[type]} icon={type === 'lost' ? SearchX : PackageCheck}>
      {REPORT_TYPE_LABELS[type]}
    </Badge>
  );
}
