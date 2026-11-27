import { ReportListView } from '../../components/reports/ReportListView';

export function MyReportsPage() {
  return (
    <ReportListView
      mine
      eyebrow="Your reports"
      title="My reports"
      lead="Everything you have reported. Open a report to edit it while it is still open, or to remove it."
      emptyTitle="You have not reported anything yet"
      emptyText="Lost something, or found something that is not yours? Report it and we will help it find its way back."
    />
  );
}
