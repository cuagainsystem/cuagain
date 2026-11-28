import type { ReportPhoto } from '../types/report';
import { prepareImage, ImageError } from '../utils/imagePrep';
import { failure, GENERIC_FAILURE, NOT_CONFIGURED, success, type Result } from './result';
import { supabase } from './supabaseClient';

export const IMAGE_BUCKET = 'item-images';
const SIGNED_URL_SECONDS = 60 * 60;

/*
  The bucket is private, so a photo is shown through a temporary signed link. Storage only
  creates the link if the signed-in user is allowed to see that photo's database row.
*/
export async function signPaths(paths: string[], bucket: string = IMAGE_BUCKET): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (!supabase || paths.length === 0) return urls;

  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl);
    }
  } catch {
    // A missing link only means the card shows its placeholder instead of the photo.
  }
  return urls;
}

export type UploadSummary = { uploaded: number; problems: string[] };

/** Uploads photos for a report, one at a time. A photo that fails does not stop the others. */
export async function uploadReportPhotos(
  userId: string,
  reportId: string,
  files: File[],
  hasPrimary: boolean,
): Promise<Result<UploadSummary>> {
  if (!supabase) return NOT_CONFIGURED;

  let uploaded = 0;
  let primaryTaken = hasPrimary;
  const problems: string[] = [];

  for (const file of files) {
    try {
      const prepared = await prepareImage(file);
      const path = `${userId}/${reportId}/${crypto.randomUUID()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, prepared.blob, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) {
        problems.push(`${file.name}: the upload failed.`);
        continue;
      }

      const { error: rowError } = await supabase.from('item_images').insert({
        report_id: reportId,
        uploaded_by: userId,
        storage_path: path,
        mime_type: 'image/jpeg',
        size_bytes: prepared.blob.size,
        width: prepared.width,
        height: prepared.height,
        is_primary: !primaryTaken,
        // The database forces this to false for sensitive categories such as IDs.
        is_public: true,
      });

      if (rowError) {
        // Do not leave a file behind that no report points to.
        await supabase.storage.from(IMAGE_BUCKET).remove([path]);
        problems.push(
          rowError.code === '23514' ? `${file.name}: a report can have at most 5 photos.` : `${file.name}: could not be saved.`,
        );
        continue;
      }

      primaryTaken = true;
      uploaded += 1;
    } catch (error) {
      problems.push(error instanceof ImageError ? error.message : `${file.name}: could not be uploaded.`);
    }
  }

  return success({ uploaded, problems });
}

export async function deleteReportPhoto(photo: Pick<ReportPhoto, 'id' | 'path'>): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    // Remove the record first. If the database refuses, the file stays and nothing is lost.
    const { data, error } = await supabase.from('item_images').delete().eq('id', photo.id).select('id');
    if (error) return GENERIC_FAILURE;
    if (!data || data.length === 0) return failure('This photo can no longer be removed.');

    await supabase.storage.from(IMAGE_BUCKET).remove([photo.path]);
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}
