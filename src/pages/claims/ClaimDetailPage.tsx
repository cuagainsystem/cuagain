import { useCallback, useState } from 'react';
import { ArrowLeft, Ban, BadgeCheck, CircleHelp, ClipboardCheck, PackageCheck, Play, Send, XCircle } from 'lucide-react';
import { useLocation, useParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { Dialog } from '../../components/common/Dialog';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { ClaimStatusBadge } from '../../components/claims/ClaimStatusBadge';
import { ClaimTimeline } from '../../components/claims/ClaimTimeline';
import { EvidenceList } from '../../components/claims/EvidenceList';
import { EvidencePicker } from '../../components/claims/EvidencePicker';
import { TextAreaField } from '../../components/forms/TextAreaField';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import {
  cancelClaim,
  completeClaim,
  getClaim,
  resubmitClaim,
  reviewClaim,
  uploadEvidence,
} from '../../services/claimService';
import type { ClaimDetail, ReviewDecision } from '../../types/claim';
import { ITEM_CATEGORIES } from '../../utils/categories';
import { formatReportDate, formatTimestamp } from '../../utils/formatDate';
import { reportRoutes, ROUTES } from '../../utils/routes';
import type { CategorySlug } from '../../types/category';
import styles from './ClaimPages.module.css';

/** The claimant's view of their own claim. */
export function ClaimDetailPage() {
  return <ClaimView mode="claimant" />;
}

/** The administrator's view: the same claim, with the review tools. */
export function AdminClaimDetailPage() {
  return <ClaimView mode="admin" />;
}

function ClaimView({ mode }: { mode: 'claimant' | 'admin' }) {
  const { id = '' } = useParams();
  const location = useLocation();
  const asAdmin = mode === 'admin';

  const load = useCallback(() => getClaim(id, { asAdmin }), [id, asAdmin]);
  const { result, reload } = useResource(load);

  const state = location.state as { notice?: string; justSent?: boolean } | null;
  const backTo = asAdmin ? ROUTES.adminClaims : ROUTES.myClaims;
  const backLabel = asAdmin ? 'All claims' : 'My claims';

  if (result === null) return <PageLoader label="Loading the claim" />;

  if (!result.ok) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <EmptyState tone="error" title="We could not load this claim" action={<Button variant="secondary" onClick={reload}>Try again</Button>}>
          {result.message}
        </EmptyState>
      </div>
    );
  }

  if (!result.data) {
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <EmptyState title="Claim not found" action={<ButtonLink to={backTo} variant="secondary">{backLabel}</ButtonLink>}>
          It may not exist, or you may not have access to it.
        </EmptyState>
      </div>
    );
  }

  const detail = result.data;
  const { claim, item } = detail;
  const category = ITEM_CATEGORIES[(item.categorySlug as CategorySlug) in ITEM_CATEGORIES ? (item.categorySlug as CategorySlug) : 'others'];

  return (
    <div className={`container ${styles.page}`}>
      <ButtonLink to={backTo} variant="ghost" size="sm" leadingIcon={ArrowLeft} className={styles.back}>
        {backLabel}
      </ButtonLink>

      <header className={styles.header}>
        <div className={styles.headerRow}>
          <ClaimStatusBadge status={claim.status} />
          <span className={styles.lead} style={{ fontSize: 'var(--text-sm)' }}>
            Sent {formatTimestamp(claim.createdAt)}
          </span>
        </div>
        <h1 className={styles.title}>{asAdmin ? `Claim for ${claim.reportTitle}` : claim.reportTitle}</h1>
      </header>

      {state?.justSent ? (
        <FormNotice tone="success" title="Claim sent">
          An administrator will review it. You will get a notification when something changes.
        </FormNotice>
      ) : null}
      {state?.notice ? <FormNotice tone="warning">{state.notice}</FormNotice> : null}

      <div className={styles.layout}>
        <div className={styles.stack}>
          <StatusPanel detail={detail} asAdmin={asAdmin} />

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{asAdmin ? 'Explanation from the claimant' : 'Your explanation'}</h2>
            <p className={styles.explanation}>{claim.explanation}</p>
            <h3 className={styles.cardTitle} style={{ fontSize: 'var(--text-lg)' }}>
              Proof of ownership
            </h3>
            <EvidenceList files={detail.evidence} />
          </section>

          {asAdmin ? <ReviewPanel detail={detail} onDone={reload} /> : <ClaimantActions detail={detail} onDone={reload} />}
        </div>

        <div className={styles.stack}>
          {asAdmin ? (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Claimant</h2>
              <dl className={styles.facts}>
                <div>
                  <dt>Username</dt>
                  <dd>{claim.claimantName ?? '—'}</dd>
                </div>
                <div>
                  <dt>Student or staff ID</dt>
                  <dd>{detail.claimantStudentId ?? '—'}</dd>
                </div>
                <div>
                  <dt>Account type</dt>
                  <dd style={{ textTransform: 'capitalize' }}>{detail.claimantRole ?? '—'}</dd>
                </div>
              </dl>
            </section>
          ) : null}

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>The item</h2>
            <dl className={styles.facts}>
              <div>
                <dt>Category</dt>
                <dd>{category.label}</dd>
              </div>
              <div>
                <dt>Found at</dt>
                <dd>{item.location || '—'}</dd>
              </div>
              <div>
                <dt>Date found</dt>
                <dd>{item.occurredOn ? formatReportDate(item.occurredOn) : '—'}</dd>
              </div>
              {asAdmin ? (
                <>
                  <div>
                    <dt>Finder&apos;s description</dt>
                    <dd>{item.description || '—'}</dd>
                  </div>
                  <div>
                    <dt>Identifying details the finder noted</dt>
                    <dd>{item.identifyingCharacteristics || 'None'}</dd>
                  </div>
                  <div>
                    <dt>Item location</dt>
                    <dd>{item.handedToOffice ? 'Handed in to the office' : 'Still with the finder'}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            <ButtonLink to={reportRoutes.detail(item.id)} variant="secondary" size="sm">
              View the report
            </ButtonLink>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Progress</h2>
            <ClaimTimeline events={detail.events} />
          </section>
        </div>
      </div>
    </div>
  );
}

/** One plain sentence about where the claim stands, and what happens next. */
function StatusPanel({ detail, asAdmin }: { detail: ClaimDetail; asAdmin: boolean }) {
  const { claim, item } = detail;
  const note = claim.decisionNote;

  if (asAdmin) return null;

  switch (claim.status) {
    case 'pending':
      return <FormNotice tone="info" title="Waiting for review">An administrator will look at your claim soon.</FormNotice>;
    case 'under_review':
      return <FormNotice tone="info" title="Under review">An administrator is checking your claim now.</FormNotice>;
    case 'more_info_required':
      return (
        <FormNotice tone="warning" title="More information needed">
          <p>{note ?? 'The administrator asked for more details.'}</p>
          <p>Answer below to send your claim back for review.</p>
        </FormNotice>
      );
    case 'approved':
      return (
        <FormNotice tone="success" title="Your claim was approved">
          {note ? <p>{note}</p> : null}
          <p>
            Bring your school ID when you collect the item.
            {item.handedToOffice ? ' The item is held at the office.' : ' The office will arrange the handover with the finder.'}
          </p>
        </FormNotice>
      );
    case 'completed':
      return <FormNotice tone="success" title="Handover confirmed">This item has been returned to you. Thank you for using CUAgain.</FormNotice>;
    case 'rejected':
      return <FormNotice tone="error" title="Your claim was not approved">{note ?? 'The administrator could not verify this claim.'}</FormNotice>;
    case 'cancelled':
      return <FormNotice tone="info" title="Claim cancelled">You withdrew this claim.</FormNotice>;
  }
}

function ClaimantActions({ detail, onDone }: { detail: ClaimDetail; onDone: () => void }) {
  const { user } = useAuth();
  const { claim } = detail;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [answer, setAnswer] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileProblem, setFileProblem] = useState<string | null>(null);

  const canCancel = ['pending', 'under_review', 'more_info_required', 'approved'].includes(claim.status);

  async function handleCancel() {
    setBusy(true);
    setError(null);
    const done = await cancelClaim(claim.id);
    setBusy(false);
    if (done.ok) {
      setConfirmOpen(false);
      onDone();
    } else {
      setError(done.message);
    }
  }

  async function handleResubmit() {
    setError(null);

    const trimmed = answer.trim();
    const combined = trimmed.length === 0 ? '' : `${claim.explanation}\n\nAdditional details: ${trimmed}`;
    if (combined.length > 2000) {
      setError('Your explanation is too long to add to. Please shorten your additional details.');
      return;
    }

    setBusy(true);
    let problems: string[] = [];
    if (files.length > 0 && user) {
      const uploaded = await uploadEvidence(user.id, claim.id, files);
      if (uploaded.ok) problems = uploaded.data.problems;
    }

    const done = await resubmitClaim(claim.id, combined);
    setBusy(false);

    if (!done.ok) {
      setError(done.message);
      return;
    }
    if (problems.length > 0) setFileProblem(problems.join(' '));
    setAnswer('');
    setFiles([]);
    onDone();
  }

  if (!canCancel) return null;

  return (
    <section className={styles.card}>
      {claim.status === 'more_info_required' ? (
        <>
          <h2 className={styles.cardTitle}>Answer the administrator</h2>
          <TextAreaField
            label="Additional details"
            rows={5}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            hint="This is added to your explanation. You can also attach more proof."
            disabled={busy}
          />
          <EvidencePicker files={files} onFilesChange={setFiles} onProblem={setFileProblem} alreadyAttached={detail.evidence.length} disabled={busy} />
          {fileProblem ? <FormNotice tone="warning">{fileProblem}</FormNotice> : null}
          <div className={styles.actions}>
            <Button leadingIcon={Send} onClick={handleResubmit} loading={busy}>
              Send for review
            </Button>
          </div>
        </>
      ) : null}

      {error && !confirmOpen ? <FormNotice tone="error">{error}</FormNotice> : null}

      <div className={styles.actions}>
        <Button variant="secondary" leadingIcon={Ban} onClick={() => setConfirmOpen(true)} disabled={busy}>
          Cancel this claim
        </Button>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => (busy ? undefined : setConfirmOpen(false))}
        title="Cancel this claim?"
        description="The item becomes available to others again. You can send a new claim later if the item is still open."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Keep claim
            </Button>
            <Button leadingIcon={Ban} onClick={handleCancel} loading={busy}>
              Cancel claim
            </Button>
          </>
        }
      >
        {error && confirmOpen ? <FormNotice tone="error">{error}</FormNotice> : null}
      </Dialog>
    </section>
  );
}

function ReviewPanel({ detail, onDone }: { detail: ClaimDetail; onDone: () => void }) {
  const { user } = useAuth();
  const { claim } = detail;

  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoverOpen, setHandoverOpen] = useState(false);

  const isOwnClaim = user?.id === claim.claimantId;
  const status = claim.status;

  if (isOwnClaim) {
    return <FormNotice tone="info">This is your own claim, so another administrator has to review it.</FormNotice>;
  }
  if (status === 'rejected' || status === 'completed' || status === 'cancelled') {
    return <FormNotice tone="info">This claim is closed. No further action is possible.</FormNotice>;
  }

  async function decide(decision: ReviewDecision) {
    setBusy(true);
    setError(null);
    const done = await reviewClaim(claim.id, decision, note);
    setBusy(false);
    if (done.ok) {
      setNote('');
      onDone();
    } else {
      setError(done.message);
    }
  }

  async function handover() {
    setBusy(true);
    setError(null);
    const done = await completeClaim(claim.id);
    setBusy(false);
    if (done.ok) {
      setHandoverOpen(false);
      onDone();
    } else {
      setError(done.message);
    }
  }

  const canStart = status === 'pending';
  const canAskMore = status === 'pending' || status === 'under_review';
  const canApprove = status === 'pending' || status === 'under_review';

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>Review</h2>

      {status === 'more_info_required' ? (
        <FormNotice tone="info">Waiting for the claimant to answer. You can still reject the claim.</FormNotice>
      ) : null}
      {status === 'approved' ? (
        <FormNotice tone="success">
          Approved. When the item is physically handed to the claimant, confirm the handover to close the report.
        </FormNotice>
      ) : null}

      <TextAreaField
        label="Note for the claimant"
        rows={4}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        maxLength={1000}
        hint="Required to approve, reject or ask for more information. The claimant sees this note. When approving, say where and when to collect the item."
        disabled={busy}
      />

      {error && !handoverOpen ? <FormNotice tone="error">{error}</FormNotice> : null}

      <div className={styles.decisionButtons}>
        {canStart ? (
          <Button variant="secondary" leadingIcon={Play} onClick={() => decide('under_review')} disabled={busy}>
            Start review
          </Button>
        ) : null}
        {canAskMore ? (
          <Button variant="secondary" leadingIcon={CircleHelp} onClick={() => decide('more_info_required')} disabled={busy}>
            Ask for more information
          </Button>
        ) : null}
        {canApprove ? (
          <Button leadingIcon={BadgeCheck} onClick={() => decide('approved')} disabled={busy}>
            Approve
          </Button>
        ) : null}
        {status === 'approved' ? (
          <Button leadingIcon={PackageCheck} onClick={() => setHandoverOpen(true)} disabled={busy}>
            Confirm handover
          </Button>
        ) : null}
        <Button variant="secondary" leadingIcon={XCircle} onClick={() => decide('rejected')} disabled={busy}>
          {status === 'approved' ? 'Withdraw approval' : 'Reject'}
        </Button>
      </div>

      <Dialog
        open={handoverOpen}
        onClose={() => (busy ? undefined : setHandoverOpen(false))}
        title="Confirm the handover?"
        description="Only do this once the item is in the claimant's hands. The report is closed and every other claim on this item is rejected."
        footer={
          <>
            <Button variant="ghost" onClick={() => setHandoverOpen(false)} disabled={busy}>
              Not yet
            </Button>
            <Button leadingIcon={ClipboardCheck} onClick={handover} loading={busy}>
              Confirm handover
            </Button>
          </>
        }
      >
        {error && handoverOpen ? <FormNotice tone="error">{error}</FormNotice> : null}
      </Dialog>
    </section>
  );
}
