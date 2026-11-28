import { useCallback, useState, type FormEvent } from 'react';
import { ArrowLeft, MapPin, PackageSearch, Send } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { EvidencePicker } from '../../components/claims/EvidencePicker';
import { TextAreaField } from '../../components/forms/TextAreaField';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { createClaim, getMyLiveClaimId } from '../../services/claimService';
import { getReport } from '../../services/reportService';
import { ITEM_CATEGORIES } from '../../utils/categories';
import { formatReportDate } from '../../utils/formatDate';
import { claimRoutes, reportRoutes, ROUTES } from '../../utils/routes';
import styles from './ClaimPages.module.css';

const MIN_LENGTH = 10;
const MAX_LENGTH = 2000;

export function ClaimFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const userId = user?.id ?? '';

  const load = useCallback(async () => {
    const report = await getReport(id);
    if (!report.ok) return report;
    const existing = await getMyLiveClaimId(userId, id);
    return { ok: true as const, data: { report: report.data, existing: existing.ok ? existing.data : null } };
  }, [id, userId]);
  const { result, reload } = useResource(load);

  const [explanation, setExplanation] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  if (result === null) return <PageLoader label="Loading the item" />;

  if (!result.ok) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <EmptyState tone="error" title="We could not load this item" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.message}
        </EmptyState>
      </div>
    );
  }

  const { report, existing } = result.data;

  if (!report) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <EmptyState icon={PackageSearch} title="Item not found" action={<ButtonLink to={ROUTES.reports} variant="secondary">Browse reports</ButtonLink>}>
          It may have been removed, or you may not have access to it.
        </EmptyState>
      </div>
    );
  }

  const blocked =
    report.reporterId === userId
      ? 'You reported this item yourself, so you cannot claim it.'
      : report.type !== 'found'
        ? 'Only found items can be claimed.'
        : report.status !== 'open' && report.status !== 'under_review'
          ? 'This item is no longer available to claim.'
          : null;

  if (blocked || existing) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <EmptyState
          title={existing ? 'You already claimed this item' : 'This item cannot be claimed'}
          action={
            existing ? (
              <ButtonLink to={claimRoutes.detail(existing.id)}>View your claim</ButtonLink>
            ) : (
              <ButtonLink to={reportRoutes.detail(report.id)} variant="secondary">Back to the item</ButtonLink>
            )
          }
        >
          {existing ? 'Open it to follow its progress.' : blocked}
        </EmptyState>
      </div>
    );
  }

  const category = ITEM_CATEGORIES[report.categorySlug];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = explanation.trim();
    if (trimmed.length < MIN_LENGTH) {
      setFieldError(`Please write at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setFieldError(`Please keep it under ${MAX_LENGTH} characters.`);
      return;
    }
    setFieldError(undefined);

    setSending(true);
    const created = await createClaim(userId, report!.id, trimmed, files);
    setSending(false);

    if (!created.ok) {
      setError(created.message);
      return;
    }

    const notice =
      created.data.problems.length > 0
        ? `Your claim was sent, but some files were not attached: ${created.data.problems.join(' ')}`
        : undefined;
    navigate(claimRoutes.detail(created.data.claimId), { replace: true, state: { notice, justSent: true } });
  }

  return (
    <div className={`container ${styles.page} ${styles.narrow}`}>
      <ButtonLink to={reportRoutes.detail(report.id)} variant="ghost" size="sm" leadingIcon={ArrowLeft} className={styles.back}>
        Back to the item
      </ButtonLink>

      <header className={styles.header}>
        <h1 className={styles.title}>Claim this item</h1>
        <p className={styles.lead}>
          Tell us why it is yours. An administrator checks every claim before anything is handed over, so be specific.
        </p>
      </header>

      <section className={styles.itemSummary} aria-label="The item you are claiming">
        <strong>{report.title}</strong>
        <span className={styles.lead} style={{ fontSize: 'var(--text-sm)' }}>
          {category.label} · <MapPin aria-hidden="true" size={14} style={{ verticalAlign: '-2px' }} /> {report.location} · {formatReportDate(report.occurredOn)}
        </span>
      </section>

      <form className={styles.stack} onSubmit={handleSubmit} noValidate>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>How can you prove it is yours?</h2>
          <TextAreaField
            label="Your explanation"
            required
            rows={7}
            value={explanation}
            onChange={(event) => setExplanation(event.target.value)}
            error={fieldError}
            maxLength={MAX_LENGTH}
            hint="Describe what only the owner would know: what is inside, marks or damage, the lock screen, a serial number, when and where you lost it."
            disabled={sending}
          />
          <EvidencePicker files={files} onFilesChange={setFiles} onProblem={setFileProblem} disabled={sending} />
          {fileProblem ? <FormNotice tone="warning">{fileProblem}</FormNotice> : null}
        </div>

        {error ? <FormNotice tone="error">{error}</FormNotice> : null}

        <div className={styles.actions}>
          <Button type="submit" leadingIcon={Send} loading={sending}>
            Send claim
          </Button>
          <ButtonLink to={reportRoutes.detail(report.id)} variant="ghost">
            Cancel
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
