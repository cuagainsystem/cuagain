import type {
  Claim,
  ClaimDetail,
  ClaimEvent,
  ClaimEvidenceFile,
  ClaimStatus,
  ClaimSummary,
  ReviewDecision,
} from '../types/claim';
import { LIVE_CLAIM_STATUSES } from '../types/claim';
import { ImageError } from '../utils/imagePrep';
import { prepareEvidence } from '../utils/evidencePrep';
import { signPaths } from './imageService';
import { failure, GENERIC_FAILURE, NOT_CONFIGURED, success, type Result } from './result';
import { supabase } from './supabaseClient';

export const EVIDENCE_BUCKET = 'claim-evidence';

type DbError = { code?: string; message?: string } | null;

/*
  Messages raised on purpose by the database rules (for example "You cannot claim an item you
  reported yourself.") are written for people, so they are shown as they are. Anything else
  becomes a generic message so no technical detail leaks to the screen.
*/
function friendlyError(error: NonNullable<DbError>, fallback: string): Result<never> {
  const deliberate = error.code === '23514' || error.code === '42501' || error.code === 'P0002';
  if (deliberate && error.message) return failure(error.message);
  if (error.code === '23505') return failure('You already have an active claim for this item.');
  return failure(fallback);
}

// ---------- Claimant ----------

type ClaimRow = {
  id: string;
  report_id: string;
  claimant_id: string;
  explanation: string;
  status: ClaimStatus;
  decision_note: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  reports: { title: string; status: string } | null;
  claimant?: { username: string } | null;
};

const CLAIM_COLUMNS =
  'id, report_id, claimant_id, explanation, status, decision_note, reviewed_at, approved_at, completed_at, cancelled_at, created_at, reports(title, status)';

function toClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    reportId: row.report_id,
    reportTitle: row.reports?.title ?? 'Item',
    reportStatus: row.reports?.status ?? 'open',
    claimantId: row.claimant_id,
    claimantName: row.claimant?.username,
    explanation: row.explanation,
    status: row.status,
    decisionNote: row.decision_note,
    reviewedAt: row.reviewed_at,
    approvedAt: row.approved_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  };
}

export type EvidenceSummary = { uploaded: number; problems: string[] };

/** Uploads evidence one file at a time. A file that fails does not stop the others. */
export async function uploadEvidence(userId: string, claimId: string, files: File[]): Promise<Result<EvidenceSummary>> {
  if (!supabase) return NOT_CONFIGURED;

  let uploaded = 0;
  const problems: string[] = [];

  for (const file of files) {
    try {
      const prepared = await prepareEvidence(file);
      const path = `${userId}/${claimId}/${crypto.randomUUID()}.${prepared.extension}`;

      const { error: uploadError } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, prepared.blob, { contentType: prepared.mimeType, upsert: false });
      if (uploadError) {
        problems.push(`${file.name}: the upload failed.`);
        continue;
      }

      const { error: rowError } = await supabase.from('claim_evidence').insert({
        claim_id: claimId,
        uploaded_by: userId,
        storage_path: path,
        mime_type: prepared.mimeType,
        size_bytes: prepared.blob.size,
      });
      if (rowError) {
        await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
        problems.push(
          rowError.code === '23514'
            ? `${file.name}: a claim can have at most 5 files.`
            : `${file.name}: could not be attached.`,
        );
        continue;
      }
      uploaded += 1;
    } catch (error) {
      problems.push(error instanceof ImageError ? error.message : `${file.name}: could not be uploaded.`);
    }
  }

  return success({ uploaded, problems });
}

export async function createClaim(
  userId: string,
  reportId: string,
  explanation: string,
  files: File[],
): Promise<Result<{ claimId: string; problems: string[] }>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from('claims')
      .insert({ report_id: reportId, claimant_id: userId, explanation: explanation.trim() })
      .select('id')
      .single();

    if (error || !data) return error ? friendlyError(error, 'Could not send your claim. Please try again.') : GENERIC_FAILURE;

    const claimId = (data as { id: string }).id;
    const upload = files.length > 0 ? await uploadEvidence(userId, claimId, files) : success({ uploaded: 0, problems: [] });
    return success({ claimId, problems: upload.ok ? upload.data.problems : ['Your files could not be uploaded.'] });
  } catch {
    return GENERIC_FAILURE;
  }
}

/** The signed-in user's current claim on this item, if they have one that is not finished. */
export async function getMyLiveClaimId(userId: string, reportId: string): Promise<Result<{ id: string; status: ClaimStatus } | null>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from('claims')
      .select('id, status')
      .eq('report_id', reportId)
      .eq('claimant_id', userId)
      .in('status', [...LIVE_CLAIM_STATUSES, 'completed'])
      .limit(1)
      .maybeSingle();

    if (error) return failure('Could not check your claim.');
    return success(data ? (data as { id: string; status: ClaimStatus }) : null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function listMyClaims(userId: string): Promise<Result<ClaimSummary[]>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from('claims')
      .select(CLAIM_COLUMNS)
      .eq('claimant_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return failure('Could not load your claims. Please try again.');
    return success(((data ?? []) as unknown as ClaimRow[]).map(toClaim));
  } catch {
    return GENERIC_FAILURE;
  }
}

type EventRow = {
  id: string;
  from_status: ClaimStatus | null;
  to_status: ClaimStatus;
  note: string | null;
  created_at: string;
  actor: { username: string } | null;
};

type EvidenceRow = { id: string; storage_path: string; mime_type: string; size_bytes: number; created_at: string };

type ItemRow = {
  id: string;
  title: string;
  location: string;
  occurred_on: string;
  handed_to_office: boolean;
  description: string;
  identifying_characteristics: string | null;
  categories: { slug: string } | null;
};

/** Returns null (inside a successful result) when the claim does not exist or is not visible. */
export async function getClaim(id: string, options: { asAdmin?: boolean } = {}): Promise<Result<ClaimDetail | null>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    const { data, error } = await supabase
      .from('claims')
      .select(`${CLAIM_COLUMNS}, claimant:profiles!claims_claimant_id_fkey(username)`)
      .eq('id', id)
      .maybeSingle();

    if (error?.code === '22P02') return success(null);
    if (error) return failure('Could not load this claim. Please try again.');
    if (!data) return success(null);

    const claim = toClaim(data as unknown as ClaimRow);

    const [itemResult, eventResult, evidenceResult] = await Promise.all([
      supabase
        .from('reports')
        .select('id, title, location, occurred_on, handed_to_office, description, identifying_characteristics, categories(slug)')
        .eq('id', claim.reportId)
        .maybeSingle(),
      supabase
        .from('claim_events')
        .select('id, from_status, to_status, note, created_at, actor:profiles(username)')
        .eq('claim_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('claim_evidence')
        .select('id, storage_path, mime_type, size_bytes, created_at')
        .eq('claim_id', id)
        .order('created_at', { ascending: true }),
    ]);

    const itemRow = itemResult.data as unknown as ItemRow | null;
    const events: ClaimEvent[] = ((eventResult.data ?? []) as unknown as EventRow[]).map((row) => ({
      id: row.id,
      actorName: row.actor?.username ?? null,
      fromStatus: row.from_status,
      toStatus: row.to_status,
      note: row.note,
      createdAt: row.created_at,
    }));

    const evidenceRows = (evidenceResult.data ?? []) as EvidenceRow[];
    const urls = await signPaths(
      evidenceRows.map((row) => row.storage_path),
      EVIDENCE_BUCKET,
    );
    const evidence: ClaimEvidenceFile[] = evidenceRows.map((row) => ({
      id: row.id,
      path: row.storage_path,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
      url: urls.get(row.storage_path),
    }));

    let claimantStudentId: string | undefined;
    let claimantRole: string | undefined;
    if (options.asAdmin) {
      const { data: privateRow } = await supabase
        .from('profile_private')
        .select('student_id, user_type')
        .eq('id', claim.claimantId)
        .maybeSingle();
      const detail = privateRow as { student_id: string; user_type: string } | null;
      claimantStudentId = detail?.student_id;
      claimantRole = detail?.user_type;
    }

    return success({
      claim,
      item: {
        id: claim.reportId,
        title: itemRow?.title ?? claim.reportTitle,
        categorySlug: itemRow?.categories?.slug ?? 'others',
        location: itemRow?.location ?? '',
        occurredOn: itemRow?.occurred_on ?? '',
        handedToOffice: itemRow?.handed_to_office ?? false,
        description: itemRow?.description ?? '',
        identifyingCharacteristics: itemRow?.identifying_characteristics ?? '',
      },
      events,
      evidence,
      claimantStudentId,
      claimantRole,
    });
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function cancelClaim(id: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.rpc('cancel_my_claim', { p_claim_id: id });
    if (error) return friendlyError(error, 'Could not cancel this claim. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function resubmitClaim(id: string, explanation: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.rpc('resubmit_my_claim', {
      p_claim_id: id,
      p_explanation: explanation.trim() === '' ? null : explanation.trim(),
    });
    if (error) return friendlyError(error, 'Could not send your answer. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

// ---------- Administrator ----------

export type ReviewQueueFilter = 'active' | 'pending' | 'approved' | 'closed' | 'all';

const QUEUE_STATUSES: Record<ReviewQueueFilter, ClaimStatus[] | null> = {
  active: ['pending', 'under_review', 'more_info_required', 'approved'],
  pending: ['pending'],
  approved: ['approved'],
  closed: ['rejected', 'completed', 'cancelled'],
  all: null,
};

export async function listClaimsForReview(filter: ReviewQueueFilter): Promise<Result<ClaimSummary[]>> {
  if (!supabase) return NOT_CONFIGURED;

  try {
    let query = supabase
      .from('claims')
      .select(`${CLAIM_COLUMNS}, claimant:profiles!claims_claimant_id_fkey(username)`)
      .order('created_at', { ascending: true })
      .limit(200);

    const statuses = QUEUE_STATUSES[filter];
    if (statuses) query = query.in('status', statuses);

    const { data, error } = await query;
    if (error) return failure('Could not load claims. Please try again.');
    return success(((data ?? []) as unknown as ClaimRow[]).map(toClaim));
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function reviewClaim(id: string, decision: ReviewDecision, note: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.rpc('admin_review_claim', {
      p_claim_id: id,
      p_decision: decision,
      p_note: note.trim() === '' ? null : note.trim(),
    });
    if (error) return friendlyError(error, 'Could not save this decision. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}

export async function completeClaim(id: string): Promise<Result<null>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { error } = await supabase.rpc('admin_complete_claim', { p_claim_id: id });
    if (error) return friendlyError(error, 'Could not confirm the handover. Please try again.');
    return success(null);
  } catch {
    return GENERIC_FAILURE;
  }
}
