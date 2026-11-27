import { useCallback, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, CalendarDays, MapPin, PackageSearch, Save, Send, Type } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { ReportTypeBadge } from '../../components/common/ReportTypeBadge';
import { CheckboxField } from '../../components/forms/CheckboxField';
import { SelectField } from '../../components/forms/SelectField';
import { TextAreaField } from '../../components/forms/TextAreaField';
import { TextField } from '../../components/forms/TextField';
import { PhotoPicker } from '../../components/reports/PhotoPicker';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { deleteReportPhoto, uploadReportPhotos } from '../../services/imageService';
import { createReport, getReport, updateReport } from '../../services/reportService';
import type { CategorySlug } from '../../types/category';
import type { ReportDetail, ReportType } from '../../types/report';
import { CATEGORY_SLUGS, ITEM_CATEGORIES } from '../../utils/categories';
import { REPORT_LIMITS, reportSchema, todayIso, type ReportFormValues } from '../../utils/reportSchemas';
import { reportRoutes, ROUTES } from '../../utils/routes';
import styles from './ReportForm.module.css';

const CATEGORY_OPTIONS = CATEGORY_SLUGS.map((slug) => ({ value: slug, label: ITEM_CATEGORIES[slug].label }));

const COPY: Record<
  ReportType,
  { title: string; lead: string; location: string; date: string; characteristicsHint: string; photoHint: string }
> = {
  lost: {
    title: 'Report a lost item',
    lead: 'Describe what you lost so that anyone who finds it can recognise it.',
    location: 'Last known location',
    date: 'Date lost',
    characteristicsHint: 'Colour, brand, stickers, scratches, a case, anything that sets it apart.',
    photoHint: 'A photo of the item, or of one like it, helps a lot. Do not show private information.',
  },
  found: {
    title: 'Report a found item',
    lead: 'Describe what you found. Keep one or two details to yourself, so the real owner can prove the item is theirs.',
    location: 'Where did you find it?',
    date: 'Date found',
    characteristicsHint: 'Mention general marks only. Do not share what is inside, or numbers on cards.',
    photoHint: 'Add a photo only if it is safe to publish: no names, ID numbers or private details visible.',
  },
};

type ReportFormProps = {
  type: ReportType;
  userId: string;
  /** Present when editing an existing report. */
  initial?: ReportDetail;
};

function ReportForm({ type, userId, initial }: ReportFormProps) {
  const navigate = useNavigate();
  const copy = COPY[type];
  const isEdit = Boolean(initial);

  const [formError, setFormError] = useState<string | null>(null);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      title: initial?.title ?? '',
      categorySlug: initial?.categorySlug ?? '',
      description: initial?.description ?? '',
      identifyingCharacteristics: initial?.identifyingCharacteristics ?? '',
      location: initial?.location ?? '',
      occurredOn: initial?.occurredOn ?? '',
      handedToOffice: initial?.handedToOffice ?? false,
    },
  });

  const selectedSlug = useWatch({ control, name: 'categorySlug' }) as CategorySlug | '';
  const selectedCategory = selectedSlug ? ITEM_CATEGORIES[selectedSlug] : undefined;

  function toggleRemoved(photoId: string) {
    setRemovedIds((ids) => (ids.includes(photoId) ? ids.filter((id) => id !== photoId) : [...ids, photoId]));
  }

  async function onSubmit(values: ReportFormValues) {
    setFormError(null);

    let reportId: string;

    if (initial) {
      const saved = await updateReport(initial.id, type, values);
      if (!saved.ok) {
        setFormError(saved.message);
        return;
      }
      reportId = initial.id;

      for (const photoId of removedIds) {
        const photo = initial.photos.find((candidate) => candidate.id === photoId);
        if (photo) await deleteReportPhoto(photo);
      }
    } else {
      const created = await createReport(userId, type, values);
      if (!created.ok) {
        setFormError(created.message);
        return;
      }
      reportId = created.data;
    }

    let notice: string | undefined;

    if (newFiles.length > 0) {
      const hasPrimary = (initial?.photos ?? []).some((photo) => photo.isPrimary && !removedIds.includes(photo.id));
      const uploaded = await uploadReportPhotos(userId, reportId, newFiles, hasPrimary);

      if (!uploaded.ok) {
        notice = 'Your report was saved, but the photos could not be uploaded. You can add them by editing the report.';
      } else if (uploaded.data.problems.length > 0) {
        notice = `Your report was saved, but some photos were not added. ${uploaded.data.problems.join(' ')}`;
      }
    }

    navigate(reportRoutes.detail(reportId), { replace: true, state: notice ? { notice } : undefined });
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.back}>
        <ButtonLink
          to={initial ? reportRoutes.detail(initial.id) : ROUTES.reports}
          variant="ghost"
          size="sm"
          leadingIcon={ArrowLeft}
        >
          {initial ? 'Back to report' : 'Back to browse'}
        </ButtonLink>
      </div>

      <header className={styles.header}>
        <ReportTypeBadge type={type} />
        <h1 className={styles.title}>{isEdit ? `Edit your ${type} report` : copy.title}</h1>
        <p className={styles.lead}>{copy.lead}</p>
      </header>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError ? <FormNotice tone="error">{formError}</FormNotice> : null}

        <section className={styles.section} aria-labelledby="about-heading">
          <h2 id="about-heading" className={styles.sectionTitle}>
            The item
          </h2>

          <TextField
            label="Item name"
            icon={Type}
            placeholder="For example: Black umbrella with a wooden handle"
            required
            maxLength={REPORT_LIMITS.title.max}
            error={errors.title?.message}
            {...register('title')}
          />

          <SelectField
            label="Category"
            placeholder="Choose a category"
            options={CATEGORY_OPTIONS}
            required
            hint={selectedCategory ? `For example: ${selectedCategory.examples}.` : undefined}
            error={errors.categorySlug?.message}
            {...register('categorySlug')}
          />

          {selectedCategory?.restrictsPublicImage ? (
            <FormNotice tone="info" title="Extra privacy for IDs and cards">
              Photos in this category are never shown to other users. Only you and the lost and found office can see them. Do
              not type ID or card numbers in the description.
            </FormNotice>
          ) : null}

          <TextAreaField
            label="Description"
            rows={5}
            required
            maxLength={REPORT_LIMITS.description.max}
            error={errors.description?.message}
            {...register('description')}
          />

          <TextAreaField
            label="Identifying characteristics"
            rows={3}
            maxLength={REPORT_LIMITS.identifying.max}
            hint={copy.characteristicsHint}
            error={errors.identifyingCharacteristics?.message}
            {...register('identifyingCharacteristics')}
          />
        </section>

        <section className={styles.section} aria-labelledby="where-heading">
          <h2 id="where-heading" className={styles.sectionTitle}>
            Where and when
          </h2>

          <div className={styles.pair}>
            <TextField
              label={copy.location}
              icon={MapPin}
              placeholder="For example: Library, second floor"
              required
              maxLength={REPORT_LIMITS.location.max}
              error={errors.location?.message}
              {...register('location')}
            />
            <TextField
              label={copy.date}
              type="date"
              icon={CalendarDays}
              required
              max={todayIso()}
              error={errors.occurredOn?.message}
              {...register('occurredOn')}
            />
          </div>

          {type === 'found' ? (
            <CheckboxField
              label="I have already handed this item to the designated lost and found office."
              {...register('handedToOffice')}
            />
          ) : null}
        </section>

        <section className={styles.section} aria-labelledby="photos-heading">
          <h2 id="photos-heading" className={styles.sectionTitle}>
            Photos
          </h2>

          {photoProblem ? <FormNotice tone="warning">{photoProblem}</FormNotice> : null}

          <PhotoPicker
            existing={initial?.photos}
            removedIds={removedIds}
            onToggleRemoved={toggleRemoved}
            files={newFiles}
            onFilesChange={setNewFiles}
            onProblem={setPhotoProblem}
            hint={copy.photoHint}
            disabled={isSubmitting}
          />
        </section>

        <div className={styles.actions}>
          <Button type="submit" leadingIcon={isEdit ? Save : Send} loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Submit report'}
          </Button>
          <ButtonLink to={initial ? reportRoutes.detail(initial.id) : ROUTES.reports} variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}

function NotAvailable({ title, children }: { title: string; children: string }) {
  return (
    <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
      <EmptyState
        icon={PackageSearch}
        title={title}
        action={
          <ButtonLink to={ROUTES.myReports} variant="secondary">
            Go to my reports
          </ButtonLink>
        }
      >
        {children}
      </EmptyState>
    </div>
  );
}

/** Route /reports/new/:type */
export function NewReportPage() {
  const { user } = useAuth();
  const { type } = useParams();

  if (type !== 'lost' && type !== 'found') {
    return <NotAvailable title="That kind of report does not exist">Choose lost or found to start a report.</NotAvailable>;
  }
  if (!user) return null;

  // The key makes React start a fresh form when someone switches between lost and found.
  return <ReportForm key={type} type={type} userId={user.id} />;
}

/** Route /reports/:id/edit */
export function EditReportPage() {
  const { user } = useAuth();
  const { id = '' } = useParams();

  const load = useCallback(() => getReport(id), [id]);
  const { result, reload } = useResource(load);

  if (result === null) return <PageLoader label="Loading your report" />;

  if (!result.ok) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <EmptyState
          tone="error"
          title="We could not load this report"
          action={
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          }
        >
          {result.message}
        </EmptyState>
      </div>
    );
  }

  const report = result.data;
  if (!report) {
    return <NotAvailable title="Report not found">It may have been removed, or you may not have access to it.</NotAvailable>;
  }
  if (!user || report.reporterId !== user.id) {
    return <NotAvailable title="You cannot edit this report">Only the person who made a report can change it.</NotAvailable>;
  }
  if (report.status !== 'open') {
    return (
      <NotAvailable title="This report can no longer be edited">
        Reports can only be changed while they are open. Once someone is reviewing it, it is locked.
      </NotAvailable>
    );
  }

  return <ReportForm key={report.id} type={report.type} userId={user.id} initial={report} />;
}
