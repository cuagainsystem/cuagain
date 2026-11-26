import type { CategorySlug } from './category';

export type ReportType = 'lost' | 'found';

export type ReportStatus = 'open' | 'under_review' | 'claimed' | 'completed';

export type ItemReport = {
  id: string;
  type: ReportType;
  title: string;
  categorySlug: CategorySlug;
  location: string;
  /** ISO date (YYYY-MM-DD): the date the item was lost or found. */
  occurredOn: string;
  status: ReportStatus;
  imageUrl?: string;
};
