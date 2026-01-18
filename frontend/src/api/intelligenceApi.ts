/**
 * Decision Intelligence API Client
 * 
 * HTTP client for /workflow/cases/{caseId}/intelligence endpoints.
 * Provides access to Decision Intelligence v2 features: confidence, gaps, bias detection.
 */

import { API_BASE } from '../lib/api';
import { getAuthHeaders, getJsonHeaders } from '../lib/authHeaders';

const WORKFLOW_BASE = `${API_BASE}/workflow`;

// ============================================================================
// Types
// ============================================================================

export interface SignalRecord {
  id: string;
  case_id: string;
  signal_type: string;
  source_type: string;
  strength: number;
  completeness: number;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface Gap {
  gap_type: 'missing' | 'partial' | 'weak' | 'stale';
  severity: 'high' | 'medium' | 'low';
  affected_area: string;
  description: string;
  expected_signal?: string;
}

export interface BiasFlag {
  bias_type: 'single_source_reliance' | 'low_diversity' | 'contradictions' | 'stale_signals';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affected_signals?: string[];
}

export interface ExplanationFactor {
  factor: string;
  impact: string;
  weight?: number;
}

export interface FailedRule {
  rule_id: string;
  title?: string;
  severity: 'critical' | 'medium' | 'low';
  message: string;
  field_path?: string | null;
  weight?: number;
  expected?: any;
  actual?: any;
}

export interface DecisionIntelligenceResponse {
  case_id: string;
  decision_type: string;
  confidence_score: number;
  confidence_band: 'high' | 'medium' | 'low';
  gaps: Gap[];
  gap_severity_score: number;
  bias_flags: BiasFlag[];
  explanation_factors: ExplanationFactor[];
  narrative: string;
  signals?: SignalRecord[];
  computed_at: string;
  // Phase 7.4: Freshness tracking
  is_stale?: boolean;
  stale_after_minutes?: number;
  // Phase 7.8: Rule-based confidence
  rules_total?: number;
  rules_passed?: number;
  rules_failed_count?: number;
  failed_rules?: FailedRule[];
  // Phase 7.14: Field-level validation
  field_checks_total?: number;
  field_checks_passed?: number;
  field_issues?: Array<{
    field: string;
    severity: 'critical' | 'medium' | 'low';
    check?: string;
    message: string;
  }>;
  confidence_rationale?: string;
}

// Phase 7.17: Intelligence History
export interface IntelligenceHistoryEntry {
  computed_at: string;
  confidence_score: number;
  confidence_band: 'high' | 'medium' | 'low' | 'unknown';
  rules_passed: number;
  rules_total: number;
  gap_count: number;
  bias_count: number;
  trigger: 'manual' | 'submission' | 'evidence' | 'request_info' | 'decision' | 'unknown';
  actor_role: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get Decision Intelligence for a case
 * 
 * Retrieves cached intelligence data including confidence score, gaps, bias flags,
 * and explanation factors.
 * 
 * @param caseId - The case identifier
 * @param decisionType - Optional decision type (e.g., 'csf', 'license_renewal')
 * @returns Promise<DecisionIntelligenceResponse>
 */
export async function getCaseIntelligence(
  caseId: string,
  decisionType?: string
): Promise<DecisionIntelligenceResponse> {
  const params = new URLSearchParams();
  if (decisionType) {
    params.set('decision_type', decisionType);
  }

  const url = `${WORKFLOW_BASE}/cases/${caseId}/intelligence${params.toString() ? '?' + params.toString() : ''}`;
  console.debug('[intelligenceApi] GET intelligence URL:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch intelligence: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Recompute Decision Intelligence for a case
 * 
 * Triggers fresh computation of intelligence data based on current signals.
 * Useful after new evidence is added or case status changes.
 * 
 * @param caseId - The case identifier
 * @param decisionType - Optional decision type (e.g., 'csf', 'license_renewal')
 * @returns Promise<DecisionIntelligenceResponse>
 */
export async function recomputeCaseIntelligence(
  caseId: string,
  decisionType?: string
): Promise<DecisionIntelligenceResponse> {
  const params = new URLSearchParams();
  if (decisionType) {
    params.set('decision_type', decisionType);
  }
  // Phase 7.7: Always include admin_unlocked=1 for local dev testing
  params.set('admin_unlocked', '1');

  const url = `${WORKFLOW_BASE}/cases/${caseId}/intelligence/recompute${params.toString() ? '?' + params.toString() : ''}`;
  console.debug('[intelligenceApi] POST recompute URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      ...getJsonHeaders(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to recompute intelligence: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Get Intelligence Computation History (Phase 7.17)
 * 
 * Retrieves historical timeline of intelligence computations for a case.
 * Shows what changed over time and what triggered each recomputation.
 * 
 * @param caseId - The case identifier
 * @param limit - Maximum number of history entries to return (default 50, max 200)
 * @returns Promise<IntelligenceHistoryEntry[]>
 */
export async function getIntelligenceHistory(
  caseId: string,
  limit: number = 50
): Promise<IntelligenceHistoryEntry[]> {
  const params = new URLSearchParams();
  params.set('limit', limit.toString());

  const url = `${WORKFLOW_BASE}/cases/${caseId}/intelligence/history?${params.toString()}`;
  console.debug('[intelligenceApi] GET history URL:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch intelligence history: ${response.status} ${errorText}`);
  }

  return response.json();
}
