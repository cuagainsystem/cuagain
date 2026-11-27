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

/** A report as shown in lists: the card data plus who owns it. */
export type ListedReport = ItemReport & {
  reporterId: string;
  isHidden: boolean;
};

export type ReportSort = 'newest' | 'date' | 'relevance';

export type SearchFilters = {
  query: string;
  type: ReportType | '';
  categorySlug: CategorySlug | '';
  location: string;
  /** ISO dates (YYYY-MM-DD) or empty. */
  from: string;
  to: string;
  status: ReportStatus | '';
  sort: ReportSort;
  /** 1-based page number. */
  page: number;
};

export const EMPTY_FILTERS: SearchFilters = {
  query: '',
  type: '',
  categorySlug: '',
  location: '',
  from: '',
  to: '',
  status: '',
  sort: 'newest',
  page: 1,
};

export type SearchPage = {
  items: ListedReport[];
  total: number;
  pageCount: number;
};

export type ReportPhoto = {
  id: string;
  path: string;
  url?: string;
  isPrimary: boolean;
  isPublic: boolean;
};

export type ReportDetail = {
  id: string;
  type: ReportType;
  title: string;
  categorySlug: CategorySlug;
  description: string;
  identifyingCharacteristics: string;
  location: string;
  occurredOn: string;
  status: ReportStatus;
  isHidden: boolean;
  handedToOffice: boolean;
  createdAt: string;
  reporterId: string;
  reporterName: string;
  photos: ReportPhoto[];
};
