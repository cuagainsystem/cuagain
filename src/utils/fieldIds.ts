/** Builds the aria-describedby value for a form control, or undefined if nothing describes it. */
export function getDescribedBy(fieldId: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids: string[] = [];
  if (hasError) ids.push(`${fieldId}-error`);
  else if (hasHint) ids.push(`${fieldId}-hint`);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
