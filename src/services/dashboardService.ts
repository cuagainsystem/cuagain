import type { ListedReport, ReportStatus } from '../types/report';
import { EMPTY_FILTERS } from '../types/report';
import { failure, GENERIC_FAILURE, NOT_CONFIGURED, success, type Result } from './result';
import { searchReports } from './reportService';
import { supabase } from './supabaseClient';

export type MyReportSummary = { total: number; open: number; byStatus: Record<ReportStatus, number> };

export type ClaimStatus =
  | 'pending'
  | 'under_review'
  | 'more_info_required'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type MyClaim = { id: string; status: ClaimStatus; createdAt: string; reportTitle: string };

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

/** Each section loads on its own, so one failure does not blank the whole dashboard. */
export type DashboardData = {
  summary: Result<MyReportSummary>;
  claims: Result<MyClaim[]>;
  recentFound: Result<ListedReport[]>;
  recentLost: Result<ListedReport[]>;
  notifications: Result<NotificationItem[]>;
};

async function loadSummary(userId: string): Promise<Result<MyReportSummary>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase.from('reports').select('status').eq('reporter_id', userId).limit(1000);
    if (error) return GENERIC_FAILURE;

    const byStatus: Record<ReportStatus, number> = { open: 0, under_review: 0, claimed: 0, completed: 0 };
    for (const row of data ?? []) byStatus[row.status as ReportStatus] += 1;
    return success({ total: data?.length ?? 0, open: byStatus.open, byStatus });
  } catch {
    return GENERIC_FAILURE;
  }
}

async function loadClaims(): Promise<Result<MyClaim[]>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    // Row Level Security already limits this to the signed-in user's own claims.
    const { data, error } = await supabase
      .from('claims')
      .select('id, status, created_at, reports(title)')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) return GENERIC_FAILURE;

    return success(
      (data ?? []).map((row) => {
        const report = row.reports as unknown as { title: string } | null;
        return {
          id: row.id as string,
          status: row.status as ClaimStatus,
          createdAt: row.created_at as string,
          reportTitle: report?.title ?? 'Removed report',
        };
      }),
    );
  } catch {
    return GENERIC_FAILURE;
  }
}

async function loadNotifications(): Promise<Result<NotificationItem[]>> {
  if (!supabase) return NOT_CONFIGURED;
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, link, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) return GENERIC_FAILURE;

    return success(
      (data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        body: (row.body as string | null) ?? null,
        link: (row.link as string | null) ?? null,
        isRead: row.is_read as boolean,
        createdAt: row.created_at as string,
      })),
    );
  } catch {
    return GENERIC_FAILURE;
  }
}

async function loadRecent(type: 'lost' | 'found'): Promise<Result<ListedReport[]>> {
  const result = await searchReports({ ...EMPTY_FILTERS, type, status: 'open' }, { pageSize: 4 });
  return result.ok ? success(result.data.items) : failure(result.message);
}

export async function loadDashboard(userId: string): Promise<DashboardData> {
  const [summary, claims, recentFound, recentLost, notifications] = await Promise.all([
    loadSummary(userId),
    loadClaims(),
    loadRecent('found'),
    loadRecent('lost'),
    loadNotifications(),
  ]);
  return { summary, claims, recentFound, recentLost, notifications };
}
