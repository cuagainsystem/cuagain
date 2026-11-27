import { ReportListView } from '../../components/reports/ReportListView';

export function BrowsePage() {
  return (
    <ReportListView
      eyebrow="Browse"
      title="Lost and found items"
      lead="Search what has been reported across campus. If something looks like yours, open it to see the details."
      emptyTitle="No reports yet"
      emptyText="When someone reports a lost or found item, it appears here. Be the first to add one."
    />
  );
}
