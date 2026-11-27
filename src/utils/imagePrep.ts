/*
  Prepares a photo before it is uploaded:
  - checks the type and size,
  - redraws it on a canvas, which removes hidden data such as the GPS location a phone adds,
  - shrinks it so uploads are fast and storage stays small.
*/

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PHOTOS_PER_REPORT = 5;
/** Largest file a person may pick. It is shrunk before upload. */
export const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
/** Hard limit enforced by the database and storage bucket. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_EDGE_PIXELS = 1600;

export class ImageError extends Error {}

/** Returns a message if the file cannot be used, or null if it is fine. */
export function validateImageFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name}: use a JPG, PNG or WebP photo.`;
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return `${file.name}: the photo is larger than 15 MB.`;
  }
  return null;
}

export type PreparedImage = { blob: Blob; width: number; height: number };

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const problem = validateImageFile(file);
  if (problem) throw new ImageError(problem);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new ImageError(`${file.name}: this photo could not be read.`);
  }

  const scale = Math.min(1, MAX_EDGE_PIXELS / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new ImageError('Your browser could not process this photo.');

  // Transparent PNGs would turn black as JPEG, so paint white first.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return { blob, width, height };
  }

  throw new ImageError(`${file.name}: the photo is still too large after shrinking. Try a smaller one.`);
}
