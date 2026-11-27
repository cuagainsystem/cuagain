import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CATEGORY_SLUGS } from '../utils/categories';
import type { CategorySlug } from '../types/category';
import { EMPTY_FILTERS, type ReportSort, type ReportStatus, type ReportType, type SearchFilters } from '../types/report';

const TYPES: ReportType[] = ['lost', 'found'];
const STATUSES: ReportStatus[] = ['open', 'under_review', 'claimed', 'completed'];
const SORTS: ReportSort[] = ['newest', 'date', 'relevance'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | '' {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : '';
}

/*
  Search filters live in the address bar (for example /reports?type=found&q=umbrella), so a
  search can be bookmarked, shared, and survives the back button. Anything unexpected in the
  address is ignored rather than trusted.
*/
export function useSearchFilters() {
  const [params, setParams] = useSearchParams();
  const paramString = params.toString();

  const filters = useMemo<SearchFilters>(() => {
    const read = new URLSearchParams(paramString);
    const from = read.get('from') ?? '';
    const to = read.get('to') ?? '';
    const page = Number.parseInt(read.get('page') ?? '1', 10);

    return {
      query: (read.get('q') ?? '').slice(0, 100),
      type: pick(read.get('type'), TYPES),
      categorySlug: pick<CategorySlug>(read.get('category'), CATEGORY_SLUGS),
      location: (read.get('location') ?? '').slice(0, 100),
      from: ISO_DATE.test(from) ? from : '',
      to: ISO_DATE.test(to) ? to : '',
      status: pick(read.get('status'), STATUSES),
      sort: pick(read.get('sort'), SORTS) || 'newest',
      page: Number.isFinite(page) && page > 0 ? Math.min(page, 1000) : 1,
    };
  }, [paramString]);

  const update = useCallback(
    (changes: Partial<SearchFilters>) => {
      const next: SearchFilters = { ...filters, ...changes };
      // Any change other than moving between pages starts again from page 1.
      if (!('page' in changes)) next.page = 1;

      const out = new URLSearchParams();
      if (next.query) out.set('q', next.query);
      if (next.type) out.set('type', next.type);
      if (next.categorySlug) out.set('category', next.categorySlug);
      if (next.location) out.set('location', next.location);
      if (next.from) out.set('from', next.from);
      if (next.to) out.set('to', next.to);
      if (next.status) out.set('status', next.status);
      if (next.sort !== EMPTY_FILTERS.sort) out.set('sort', next.sort);
      if (next.page > 1) out.set('page', String(next.page));

      setParams(out, { replace: true });
    },
    [filters, setParams],
  );

  const clear = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  return { filters, update, clear };
}
