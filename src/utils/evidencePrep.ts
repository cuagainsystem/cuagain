import { ImageError, prepareImage, validateImageFile } from './imagePrep';

export const MAX_EVIDENCE_FILES = 5;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export function isPdf(file: Pick<File, 'type'>): boolean {
  return file.type === 'application/pdf';
}

/** Returns a message if the file cannot be used as evidence, or null if it is fine. */
export function validateEvidenceFile(file: File): string | null {
  if (isPdf(file)) {
    return file.size > MAX_PDF_BYTES ? `${file.name}: the PDF is larger than 10 MB.` : null;
  }
  return validateImageFile(file);
}

export type PreparedEvidence = { blob: Blob; mimeType: string; extension: 'jpg' | 'pdf' };

/*
  Photos are redrawn and shrunk (which also removes the hidden location data phones add).
  PDFs are checked for the real PDF marker, not just the file name.
*/
export async function prepareEvidence(file: File): Promise<PreparedEvidence> {
  const problem = validateEvidenceFile(file);
  if (problem) throw new ImageError(problem);

  if (isPdf(file)) {
    const head = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (head !== '%PDF-') throw new ImageError(`${file.name}: this is not a valid PDF.`);
    return { blob: file, mimeType: 'application/pdf', extension: 'pdf' };
  }

  const prepared = await prepareImage(file);
  return { blob: prepared.blob, mimeType: 'image/jpeg', extension: 'jpg' };
}
