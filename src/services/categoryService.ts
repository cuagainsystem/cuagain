import type { CategorySlug } from '../types/category';
import { failure, GENERIC_FAILURE, NOT_CONFIGURED, success, type Result } from './result';
import { supabase } from './supabaseClient';

export type CategoryIds = Record<CategorySlug, string>;

let cache: CategoryIds | null = null;

/** Maps each category slug to its database id. The list barely changes, so it is fetched once. */
export async function getCategoryIds(): Promise<Result<CategoryIds>> {
  if (cache) return success(cache);
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase.from('categories').select('id, slug');
    if (error || !data) return GENERIC_FAILURE;

    const ids: Partial<CategoryIds> = {};
    for (const row of data) ids[row.slug as CategorySlug] = row.id as string;

    if (Object.keys(ids).length === 0) return failure('No categories are set up yet.');
    cache = ids as CategoryIds;
    return success(cache);
  } catch {
    return GENERIC_FAILURE;
  }
}
