import type { CategorySlug } from '../types/category';
import type {
  ListedReport,
  ReportDetail,
  ReportPhoto,
  ReportStatus,
  ReportType,
  SearchFilters,
  SearchPage,
} from '../types/report';
import type { ReportFormValues } from '../utils/reportSchemas';
import { getCategoryIds } from './categoryService';
import { IMAGE_BUCKET, signPaths } from './imageService';
import { failure, GENERIC_FAILURE, NOT_CONFIGURED, success, type Result } from './result';
import { supabase } from './supabaseClient';

export const PAGE_SIZE = 12;

type SearchRow = {
  id: string;
  reporter_id: string;
  type: ReportType;
  title: string;
  category_slug: CategorySlug;
  location: string;
  occurred_on: string;
  status: ReportStatus;
  is_hidden: boolean;
  image_path: string | null;
  total_count: number | string;
};

function emptyToNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim();
}

/*
  Keyword search, filters, sorting and paging all happen in one database function
  (search_reports, migration 8). It runs with the caller's permissions, so a user never
  receives a report they are not allowed to see.
*/
export async function searchReports(
  filters: SearchFilters,
  options: { mine?: boolean; pageSize?: number } = {},
): Promise<Result<SearchPage>> {
  if (!supabase) return NOT_CONFIGURED;

  const pageSize = options.pageSize ?? PAGE_SIZE;

  try {
    let categoryId: string | null = null;
    if (filters.categorySlug) {
      const ids = await getCategoryIds();
      if (!ids.ok) return ids;
      categoryId = ids.data[filters.categorySlug] ?? null;
    }

    const { data, error } = await supabase.rpc('search_reports', {
      p_query: emptyToNull(filters.query),
      p_type: filters.type || null,
      p_category_id: categoryId,
      p_location: emptyToNull(filters.location),
      p_from: emptyToNull(filters.from),
      p_to: emptyToNull(filters.to),
      p_status: filters.status || null,
      p_mine: Boolean(options.mine),
      p_sort: filters.sort,
      p_limit: pageSize,
      p_offset: (Math.max(1, filters.page) - 1) * pageSize,
    });

    if (error) return failure('Could not load reports. Please try again.');

    const rows = (data ?? []) as SearchRow[];
    const urls = await signPaths(rows.map((row) => row.image_path).filter((path): path is string => Boolean(path)));

    const items: ListedReport[] = rows.map((row) => ({
      id: row.id,
      reporterId: row.reporter_id,
      type: row.type,
      title: row.title,
      categorySlug: row.category_slug,
      location: row.location,
      occurredOn: row.occurred_on,
      status: row.status,
      isHidden: row.is_hidden,
      imageUrl: row.image_path ? urls.get(row.image_path) : undefined,
    }));

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    return success({ items, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) });
  } catch {
    return GENERIC_FAILURE;
  }
}

type DetailRow = {
  id: string;
  reporter_id: string;
  type: ReportType;
  title: string;
  description: string;
  identifying_characteristics: string | null;
  location: string;
  occurred_on: string;
  status: ReportStatus;
  is_hidden: boolean;
  handed_to_office: boolean;
  created_at: string;
  categories: { slug: CategorySlug } | null;
  reporter: { username: string } | null;
};

type PhotoRow = { id: string; storage_path: string; is_primary: boolean; is_public: boolean };

/** Returns null (inside a successful result) when the report does not exist or is not visible. */
export async function getReport(id: string): Promise<Result<ReportDetail | null>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from('reports')
      .select(
        'id, reporter_id, type, title, description, identifying_characteristics, location, occurred_on, status, is_hidden, handed_to_office, created_at, categories(slug), reporter:profiles(username)',
      )
      .eq('id', id)
      .maybeSingle();

    // An id that is not a valid UUID makes the database complain. To the user it is just "not found".
    if (error?.code === '22P02') return success(null);
    if (error) return failure('Could not load this report. Please try again.');
    if (!data) return success(null);

    const row = data as unknown as DetailRow;

    const { data: photoRows } = await supabase
      .from('item_images')
      .select('id, storage_path, is_primary, is_public')
      .eq('report_id', id)
      .order('is_primary', { ascending: false })
      .order('created_at');

    const photoList = (photoRows ?? []) as PhotoRow[];
    const urls = await signPaths(photoList.map((photo) => photo.storage_path));

    const photos: ReportPhoto[] = photoList.map((photo) => ({
      id: photo.id,
      path: photo.storage_path,
      url: urls.get(photo.storage_path),
      isPrimary: photo.is_primary,
      isPublic: photo.is_public,
    }));

    return success({
      id: row.id,
      type: row.type,
      title: row.title,
      categorySlug: row.categories?.slug ?? 'others',
      description: row.description,
      identifyingCharacteristics: row.identifying_characteristics ?? '',
      location: row.location,
      occurredOn: row.occurred_on,
      status: row.status,
      isHidden: row.is_hidden,
      handedToOffice: row.handed_to_office,
      createdAt: row.created_at,
      reporterId: row.reporter_id,
      reporterName: row.reporter?.username ?? 'A user',
      photos,
    });
  } catch {
    return GENERIC_FAILURE;
  }
}

function writeFailure(code: string | undefined, fallback: string): Result<never> {
  if (code === '42501') return failure('Your account cannot make changes right now.');
  if (code === '23514') return failure('Some details are not allowed. Check the date, category and text lengths.');
  return failure(fallback);
}

export async function createReport(userId: string, type: ReportType, values: ReportFormValues): Promise<Result<string>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const ids = await getCategoryIds();
    if (!ids.ok) return ids;

    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: userId,
        type,
        title: values.title,
        category_id: ids.data[values.categorySlug as CategorySlug],
        description: values.description,
        identifying_characteristics: emptyToNull(values.identifyingCharacteristics),
        location: values.location,
        occurred_on: values.occurredOn,
        handed_to_office: type === 'found' && values.handedToOffice,
      })
      .select('id')
      .single();

    if (error || !data) return writeFailure(error?.code, 'Could not save your report. Please try again.');
    return success(data.id as string);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function updateReport(id: string, type: ReportType, values: ReportFormValues): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const ids = await getCategoryIds();
    if (!ids.ok) return ids;

    // The type and status are not editable here: the database refuses changes to them.
    const { data, error } = await supabase
      .from('reports')
      .update({
        title: values.title,
        category_id: ids.data[values.categorySlug as CategorySlug],
        description: values.description,
        identifying_characteristics: emptyToNull(values.identifyingCharacteristics),
        location: values.location,
        occurred_on: values.occurredOn,
        handed_to_office: type === 'found' && values.handedToOffice,
      })
      .eq('id', id)
      .select('id');

    if (error) return writeFailure(error.code, 'Could not save your changes. Please try again.');
    if (!data || data.length === 0) return failure('This report can no longer be edited. Only open reports can be changed.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function deleteReport(id: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data: photoRows } = await supabase.from('item_images').select('storage_path').eq('report_id', id);
    const paths = (photoRows ?? []).map((row) => row.storage_path as string);

    const { data, error } = await supabase.from('reports').delete().eq('id', id).select('id');
    if (error) return GENERIC_FAILURE;
    if (!data || data.length === 0) return failure('This report can no longer be deleted. Only open reports can be removed.');

    if (paths.length > 0) await supabase.storage.from(IMAGE_BUCKET).remove(paths);
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}
