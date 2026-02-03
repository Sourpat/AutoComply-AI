/**
 * Analytics API Client
 * 
 * HTTP client functions for /api/analytics endpoints.
 * Handles all API communication with the backend analytics service.
 */

import { API_BASE, apiFetch } from '../lib/api';
import { getAuthHeaders } from '../lib/authHeaders';
import { cachedFetchJson } from './apiCache';

const ANALYTICS_BASE = `${API_BASE}/api/analytics`;
const CONSOLE_ANALYTICS_BASE = "/api/console/analytics";

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsSummary {
  totalCases: number;
  openCount: number;
  closedCount: number;
  overdueCount: number;
  dueSoonCount: number;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
}

export interface DecisionTypeBreakdownItem {
  decisionType: string;
  count: number;
}

export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface TopEventTypeItem {
  eventType: string;
  count: number;
}

export interface EvidenceTagItem {
  tag: string;
  count: number;
}

export interface VerifierActivityItem {
  actor: string;
  count: number;
}

export interface RequestInfoBreakdownItem {
  reason: string;
  count: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  statusBreakdown: StatusBreakdownItem[];
  decisionTypeBreakdown: DecisionTypeBreakdownItem[];
  casesCreatedTimeSeries: TimeSeriesPoint[];
  casesClosedTimeSeries: TimeSeriesPoint[];
  topEventTypes: TopEventTypeItem[];
  verifierActivity: VerifierActivityItem[];
  evidenceTags: EvidenceTagItem[];
  requestInfoReasons: RequestInfoBreakdownItem[];
}

export interface ConsoleAnalyticsSummaryResponse {
  total_cases: number;
  open_cases: number;
  closed_cases: number;
  overdue_cases: number;
  due_24h: number;
  status_breakdown: Array<{ name: string; count: number }>;
  decision_type_breakdown: Array<{ name: string; count: number }>;
  cases_created_daily: Array<{ date: string; count: number }>;
  cases_closed_daily: Array<{ date: string; count: number }>;
  top_event_types: Array<{ name: string; count: number }>;
  verifier_activity: Array<{ name: string; count: number }>;
  top_evidence_tags: Array<{ name: string; count: number }>;
  request_info_reasons: Array<{ name: string; count: number }>;
}

export interface SLAMetrics {
  overdueCount: number;
  dueSoonCount: number;
  avgAgeOpen: number;
  avgTimeToClose: number;
  totalOpen: number;
  totalClosed: number;
}

export interface AuditMetrics {
  topEventTypes: TopEventTypeItem[];
  verifierActivity: VerifierActivityItem[];
  auditTimeSeries: TimeSeriesPoint[];
}

export interface EvidenceMetrics {
  evidenceTags: EvidenceTagItem[];
  packetInclusionRate: number;
  totalEvidence: number;
  packetedEvidence: number;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface AnalyticsOverviewParams {
  days?: number;
  decisionType?: string;
  assignedTo?: string;
}

export interface AnalyticsAuditParams {
  days?: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get comprehensive analytics overview
 * 
 * @param params - Optional query parameters (days, decisionType, assignedTo)
 * @returns Complete analytics response with summary, breakdowns, and time series
 */
export async function getAnalyticsOverview(
  params?: AnalyticsOverviewParams
): Promise<AnalyticsResponse> {
  const queryParams = new URLSearchParams();
  
  if (params?.days !== undefined) {
    queryParams.set('days', String(params.days));
  }
  if (params?.decisionType) {
    queryParams.set('decisionType', params.decisionType);
  }
  if (params?.assignedTo) {
    queryParams.set('assignedTo', params.assignedTo);
  }
  
  const url = queryParams.toString()
    ? `${ANALYTICS_BASE}/overview?${queryParams}`
    : `${ANALYTICS_BASE}/overview`;
  
  return cachedFetchJson<AnalyticsResponse>(url, {
    headers: getAuthHeaders(),
  });
}

/**
 * Get SLA-focused metrics
 * 
 * @returns SLA metrics including overdue, due soon, avg age, and avg time to close
 */
export async function getAnalyticsSla(): Promise<SLAMetrics> {
  return cachedFetchJson<SLAMetrics>(`${ANALYTICS_BASE}/sla`, {
    headers: getAuthHeaders(),
  });
}

/**
 * Get audit-focused metrics
 * 
 * @param params - Optional query parameters (days)
 * @returns Audit metrics including top event types, verifier activity, and time series
 */
export async function getAnalyticsAudit(
  params?: AnalyticsAuditParams
): Promise<AuditMetrics> {
  const queryParams = new URLSearchParams();
  
  if (params?.days !== undefined) {
    queryParams.set('days', String(params.days));
  }
  
  const url = queryParams.toString()
    ? `${ANALYTICS_BASE}/audit?${queryParams}`
    : `${ANALYTICS_BASE}/audit`;
  
  return cachedFetchJson<AuditMetrics>(url, {
    headers: getAuthHeaders(),
  });
}

/**
 * Get evidence-focused metrics
 * 
 * @returns Evidence metrics including tag frequency and packet inclusion stats
 */
export async function getAnalyticsEvidence(): Promise<EvidenceMetrics> {
  return cachedFetchJson<EvidenceMetrics>(`${ANALYTICS_BASE}/evidence`, {
    headers: getAuthHeaders(),
  });
}

/**
 * Console analytics summary (Phase 10.5)
 */
export async function getConsoleAnalyticsSummary(days: number = 30): Promise<ConsoleAnalyticsSummaryResponse> {
  const params = new URLSearchParams({ days: String(days) });
  return apiFetch<ConsoleAnalyticsSummaryResponse>(
    `${CONSOLE_ANALYTICS_BASE}/summary?${params.toString()}`,
    { headers: getAuthHeaders() }
  );
}
