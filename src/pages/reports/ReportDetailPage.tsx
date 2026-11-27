import { useCallback, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  HandHelping,
  MapPin,
  PackageSearch,
  Pencil,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { ButtonLink } from '../../components/common/ButtonLink';
import { Dialog } from '../../components/common/Dialog';
import { EmptyState } from '../../components/common/EmptyState';
import { FormNotice } from '../../components/common/FormNotice';
import { PageLoader } from '../../components/common/PageLoader';
import { ReportTypeBadge } from '../../components/common/ReportTypeBadge';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { useResource } from '../../hooks/useResource';
import { deleteReport, getReport } from '../../services/reportService';
import { ITEM_CATEGORIES } from '../../utils/categories';
import { formatReportDate } from '../../utils/formatDate';
import { reportRoutes, ROUTES } from '../../utils/routes';
import styles from './ReportDetail.module.css';

export function ReportDetailPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { id = '' } = useParams();

  const load = useCallback(() => getReport(id), [id]);
  const { result, reload } = useResource(load);

  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const notice = (location.state as { notice?: string } | null)?.notice;

  if (result === null) return <PageLoader label="Loading the report" />;

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
    return (
      <div className="container" style={{ paddingBlock: 'var(--space-8)' }}>
        <EmptyState
          icon={PackageSearch}
          title="Report not found"
          action={
            <ButtonLink to={ROUTES.reports} variant="secondary">
              Browse reports
            </ButtonLink>
          }
        >
          It may have been removed, or you may not have access to it.
        </EmptyState>
      </div>
    );
  }

  const category = ITEM_CATEGORIES[report.categorySlug];
  const CategoryIcon = category.icon;
  const isOwner = user?.id === report.reporterId;
  const canManage = isOwner && report.status === 'open';
  const canBeClaimed = !isOwner && report.type === 'found' && (report.status === 'open' || report.status === 'under_review');
  const photos = report.photos.filter((photo) => photo.url);
  const activePhoto = photos[Math.min(selectedPhoto, Math.max(0, photos.length - 1))];
  const dateLabel = report.type === 'lost' ? 'Date lost' : 'Date found';
  const locationLabel = report.type === 'lost' ? 'Last known location' : 'Found at';

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(null);

    const removed = await deleteReport(report!.id);
    setDeleting(false);

    if (removed.ok) {
      navigate(ROUTES.myReports, { replace: true });
    } else {
      setDeleteError(removed.message);
    }
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.back}>
        <ButtonLink to={ROUTES.reports} variant="ghost" size="sm" leadingIcon={ArrowLeft}>
          Back to browse
        </ButtonLink>
      </div>

      {notice ? <FormNotice tone="warning">{notice}</FormNotice> : null}
      {report.isHidden && isOwner ? (
        <FormNotice tone="warning" title="Hidden by an administrator">
          Other users cannot see this report right now. The office may contact you about it.
        </FormNotice>
      ) : null}

      <div className={styles.layout}>
        <section className={styles.gallery} aria-label="Photos">
          <div className={styles.stage}>
            {activePhoto ? (
              <img src={activePhoto.url} alt={`Photo of ${report.title}`} />
            ) : (
              <div className={styles.noPhoto}>
                <CategoryIcon aria-hidden="true" />
                <p>{category.restrictsPublicImage ? 'Photo hidden for privacy' : 'No photo added'}</p>
              </div>
            )}
          </div>

          {photos.length > 1 ? (
            <ul className={styles.thumbs}>
              {photos.map((photo, index) => (
                <li key={photo.id}>
                  <button
                    type="button"
                    className={styles.thumb}
                    data-active={photo === activePhoto}
                    onClick={() => setSelectedPhoto(index)}
                    aria-label={`Show photo ${index + 1} of ${photos.length}`}
                    aria-pressed={photo === activePhoto}
                  >
                    <img src={photo.url} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {isOwner && category.restrictsPublicImage && photos.length > 0 ? (
            <p className={styles.privateNote}>
              <ShieldCheck aria-hidden="true" />
              Only you and the lost and found office can see this photo.
            </p>
          ) : null}
        </section>

        <section className={styles.info} aria-label="Report details">
          <div className={styles.badges}>
            <ReportTypeBadge type={report.type} />
            <StatusBadge status={report.status} />
          </div>

          <p className={styles.category}>
            <CategoryIcon aria-hidden="true" />
            {category.label}
          </p>

          <h1 className={styles.title}>{report.title}</h1>

          <div className={styles.block}>
            <h2 className={styles.blockTitle}>Description</h2>
            <p className={styles.text}>{report.description}</p>
          </div>

          {report.identifyingCharacteristics ? (
            <div className={styles.block}>
              <h2 className={styles.blockTitle}>Identifying characteristics</h2>
              <p className={styles.text}>{report.identifyingCharacteristics}</p>
            </div>
          ) : null}

          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>
                <MapPin aria-hidden="true" />
                {locationLabel}
              </dt>
              <dd>{report.location}</dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <CalendarDays aria-hidden="true" />
                {dateLabel}
              </dt>
              <dd>{formatReportDate(report.occurredOn)}</dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <UserRound aria-hidden="true" />
                Reported by
              </dt>
              <dd>{isOwner ? 'You' : report.reporterName}</dd>
            </div>
            <div className={styles.fact}>
              <dt>
                <Clock aria-hidden="true" />
                Posted
              </dt>
              <dd>{formatReportDate(report.createdAt.slice(0, 10))}</dd>
            </div>
            {report.type === 'found' ? (
              <div className={styles.fact}>
                <dt>
                  <HandHelping aria-hidden="true" />
                  Item location
                </dt>
                <dd>{report.handedToOffice ? 'Handed to the lost and found office' : 'Still with the finder'}</dd>
              </div>
            ) : null}
          </dl>

          {canManage ? (
            <div className={styles.actions}>
              <ButtonLink to={reportRoutes.edit(report.id)} leadingIcon={Pencil}>
                Edit report
              </ButtonLink>
              <Button variant="secondary" leadingIcon={Trash2} onClick={() => setConfirmOpen(true)}>
                Delete report
              </Button>
            </div>
          ) : null}

          {isOwner && !canManage ? (
            <FormNotice tone="info">This report is locked because it is no longer open, so it cannot be edited or deleted.</FormNotice>
          ) : null}

          {canBeClaimed ? (
            <div className={styles.claim}>
              <h2 className={styles.blockTitle}>Is this yours?</h2>
              <p className={styles.text}>
                Ownership claims open in the next update. Until then, note the details above and check back soon.
              </p>
              <Button disabled>Claim this item</Button>
            </div>
          ) : null}
        </section>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => (deleting ? undefined : setConfirmOpen(false))}
        title="Delete this report?"
        description="The report and its photos will be removed for good. This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Keep report
            </Button>
            <Button leadingIcon={Trash2} onClick={confirmDelete} loading={deleting}>
              Delete report
            </Button>
          </>
        }
      >
        {deleteError ? <FormNotice tone="error">{deleteError}</FormNotice> : null}
      </Dialog>
    </div>
  );
}
