import { z } from 'zod';
import { format } from 'date-fns';
import { CATEGORY_SLUGS } from './categories';

/*
  Validation for the lost and found report form. The same limits are enforced again by the
  database (migration 3), so these messages are for usability, not security.
*/

export const REPORT_LIMITS = {
  title: { min: 3, max: 120 },
  description: { min: 10, max: 2000 },
  identifying: { max: 1000 },
  location: { min: 2, max: 160 },
} as const;

/** Today as YYYY-MM-DD in the user's own time zone. */
export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export const reportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(REPORT_LIMITS.title.min, `Give the item a name of at least ${REPORT_LIMITS.title.min} characters.`)
    .max(REPORT_LIMITS.title.max, `Keep the name under ${REPORT_LIMITS.title.max} characters.`),
  categorySlug: z.enum(CATEGORY_SLUGS as [string, ...string[]], { error: 'Choose a category.' }),
  description: z
    .string()
    .trim()
    .min(REPORT_LIMITS.description.min, `Describe the item in at least ${REPORT_LIMITS.description.min} characters.`)
    .max(REPORT_LIMITS.description.max, `Keep the description under ${REPORT_LIMITS.description.max} characters.`),
  identifyingCharacteristics: z
    .string()
    .trim()
    .max(REPORT_LIMITS.identifying.max, `Keep this under ${REPORT_LIMITS.identifying.max} characters.`),
  location: z
    .string()
    .trim()
    .min(REPORT_LIMITS.location.min, 'Enter a location.')
    .max(REPORT_LIMITS.location.max, `Keep the location under ${REPORT_LIMITS.location.max} characters.`),
  occurredOn: z
    .string()
    .min(1, 'Choose a date.')
    .refine((value) => value <= todayIso(), 'The date cannot be in the future.'),
  handedToOffice: z.boolean(),
});

export type ReportFormValues = z.infer<typeof reportSchema>;
