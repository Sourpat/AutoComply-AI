// frontend/src/contracts/verificationWorkEvent.ts
/**
 * Verification Work Event Contract
 * 
 * Unified representation of verification workload across Chat HITL, CSF submissions,
 * and License checks. This contract enables:
 * - Standardized workload tracking and metrics
 * - Unified ops dashboard views
 * - Routing to appropriate execution surfaces (Review Queue vs Compliance Console)
 * 
 * Does NOT change existing decisioning logic or data models.
 */

import type { ReviewQueueItem } from "../api/reviewQueueClient";

// ============================================================================
// Enums
// ============================================================================

export enum VerificationSource {
  CHAT = "CHAT",
  CSF = "CSF",
  LICENSE = "LICENSE",
  SYSTEM = "SYSTEM",
}

export enum VerificationWorkStatus {
  OPEN = "OPEN",
  IN_REVIEW = "IN_REVIEW",
  RESOLVED = "RESOLVED",
  PUBLISHED = "PUBLISHED",
  BLOCKED = "BLOCKED",
}

export enum RiskLevel {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

// ============================================================================
// Main Contract Interface
// ============================================================================

export interface VerificationWorkEvent {
  id: string; // stable identifier, e.g. "chat:7" or "csf:12345"
  source: VerificationSource;
  status: VerificationWorkStatus;
  risk: RiskLevel;
  created_at: string; // ISO string
  updated_at?: string; // ISO string optional
  jurisdiction?: string; // "CA", "OH", etc.
  reason_code?: string; // standardized string (uppercase snake_case)
  title: string; // short label for list rows
  summary?: string; // longer description (no raw JSON)
  link?: {
    label: string;
    href: string; // where user should go to execute (review queue or compliance console)
  };
  artifact?: {
    type: "CHAT_QUESTION" | "CSF_SUBMISSION" | "LICENSE_CHECK" | "SYSTEM_EXCEPTION";
    artifact_id?: string;
  };
  trace?: {
    trace_id?: string;
    queue_item_id?: number | string;
  };
  metrics?: {
    age_hours?: number;
    sla_bucket?: "UNDER_4H" | "UNDER_24H" | "OVER_24H";
  };
}

// ============================================================================
// Helper: Normalize Reason Code
// ============================================================================

/**
 * Standardizes reason codes to uppercase snake_case format
 */
export function normalizeReasonCode(input: string | null | undefined): string | undefined {
  if (!input) return undefined;

  const normalized = input.toLowerCase().trim();

  // Common mappings
  const mappings: Record<string, string> = {
    "low similarity": "LOW_SIMILARITY",
    "low_similarity": "LOW_SIMILARITY",
    "jurisdiction mismatch": "JURISDICTION_MISMATCH",
    "jurisdiction_mismatch": "JURISDICTION_MISMATCH",
    "unsafe_request": "UNSAFE_REQUEST",
    "unsafe request": "UNSAFE_REQUEST",
    "system_error": "SYSTEM_ERROR",
    "system error": "SYSTEM_ERROR",
    "no_kb_match": "NO_KB_MATCH",
    "no kb match": "NO_KB_MATCH",
    "policy_gate": "POLICY_GATE",
    "policy gate": "POLICY_GATE",
  };

  if (mappings[normalized]) {
    return mappings[normalized];
  }

  // Default: convert to uppercase snake_case
  return normalized.replace(/\s+/g, "_").toUpperCase();
}

// ============================================================================
// Helper: Infer Risk Level
// ============================================================================

/**
 * Infers risk level from source and reason code
 */
export function inferRiskLevel(params: {
  source: VerificationSource;
  reason_code?: string;
}): RiskLevel {
  const { reason_code } = params;
  const normalized = normalizeReasonCode(reason_code);

  if (!normalized) return RiskLevel.LOW;

  // High risk indicators
  const highRiskCodes = ["JURISDICTION_MISMATCH", "UNSAFE_REQUEST"];
  if (highRiskCodes.includes(normalized)) {
    return RiskLevel.HIGH;
  }

  // Medium risk indicators
  const mediumRiskCodes = ["LOW_SIMILARITY", "SYSTEM_ERROR", "NO_KB_MATCH"];
  if (mediumRiskCodes.includes(normalized)) {
    return RiskLevel.MEDIUM;
  }

  return RiskLevel.LOW;
}

// ============================================================================
// Helper: Map Status
// ============================================================================

/**
 * Maps legacy status strings to VerificationWorkStatus
 */
export function mapStatus(status: string): VerificationWorkStatus {
  const normalized = status.toLowerCase().trim();

  switch (normalized) {
    case "open":
      return VerificationWorkStatus.OPEN;
    case "in_review":
    case "in review":
      return VerificationWorkStatus.IN_REVIEW;
    case "resolved":
    case "completed":
      return VerificationWorkStatus.RESOLVED;
    case "published":
      return VerificationWorkStatus.PUBLISHED;
    case "blocked":
      return VerificationWorkStatus.BLOCKED;
    default:
      return VerificationWorkStatus.OPEN;
  }
}

// ============================================================================
// Helper: Calculate Age Metrics
// ============================================================================

/**
 * Calculates age in hours and SLA bucket from created timestamp
 */
export function calculateAgeMetrics(created_at: string): {
  age_hours: number;
  sla_bucket: "UNDER_4H" | "UNDER_24H" | "OVER_24H";
} {
  try {
    const now = new Date().getTime();
    const created = new Date(created_at).getTime();
    const age_hours = (now - created) / (1000 * 60 * 60);

    let sla_bucket: "UNDER_4H" | "UNDER_24H" | "OVER_24H";
    if (age_hours < 4) {
      sla_bucket = "UNDER_4H";
    } else if (age_hours < 24) {
      sla_bucket = "UNDER_24H";
    } else {
      sla_bucket = "OVER_24H";
    }

    return { age_hours, sla_bucket };
  } catch {
    return { age_hours: 0, sla_bucket: "UNDER_4H" };
  }
}

// ============================================================================
// Mapper: Chat Review Item -> Verification Work Event
// ============================================================================

/**
 * Converts a Chat Review Queue Item to a Verification Work Event
 */
export function fromChatReviewItem(item: ReviewQueueItem): VerificationWorkEvent {
  const normalizedReasonCode = normalizeReasonCode(item.reason_code);
  const risk = inferRiskLevel({
    source: VerificationSource.CHAT,
    reason_code: normalizedReasonCode,
  });
  const status = mapStatus(item.status);
  const metrics = calculateAgeMetrics(item.created_at);

  // Create title from question (first 60 chars)
  const title = item.question_text.length > 60
    ? item.question_text.substring(0, 57) + "..."
    : item.question_text;

  return {
    id: `chat:${item.id}`,
    source: VerificationSource.CHAT,
    status,
    risk,
    created_at: item.created_at,
    updated_at: item.published_at || item.approved_at || item.assigned_at || undefined,
    jurisdiction: undefined, // Not available in current ReviewQueueItem type
    reason_code: normalizedReasonCode,
    title,
    summary: item.question_text,
    link: {
      label: "Open in Chat Review Queue",
      href: `/admin/review/${item.id}`,
    },
    artifact: {
      type: "CHAT_QUESTION",
      artifact_id: item.id.toString(),
    },
    trace: {
      queue_item_id: item.id,
    },
    metrics: {
      age_hours: metrics.age_hours,
      sla_bucket: metrics.sla_bucket,
    },
  };
}

// ============================================================================
// Mapper: CSF Artifact -> Verification Work Event (STUB)
// ============================================================================

/**
 * Converts a CSF submission to a Verification Work Event
 * 
 * TODO: Wire up when CSF verification queue is available
 * Expected input shape (to be defined):
 * - id: string/number
 * - form_type: "hospital" | "facility" | "practitioner" | "ems" | "researcher"
 * - status: "submitted" | "pending" | "approved" | "blocked"
 * - created_at: string
 * - jurisdiction?: string
 * - scenario?: string
 * - tenant?: string
 */
export function fromCSFArtifact(csfItem: any): VerificationWorkEvent {
  // Stub implementation - returns a placeholder event
  const normalizedReasonCode = normalizeReasonCode(csfItem.reason_code);
  const risk = inferRiskLevel({
    source: VerificationSource.CSF,
    reason_code: normalizedReasonCode,
  });

  // Map CSF-specific status
  let status = VerificationWorkStatus.OPEN;
  if (csfItem.status === "approved" || csfItem.status === "ok_to_ship") {
    status = VerificationWorkStatus.RESOLVED;
  } else if (csfItem.status === "blocked" || csfItem.status === "needs_review") {
    status = VerificationWorkStatus.BLOCKED;
  }

  const metrics = csfItem.created_at ? calculateAgeMetrics(csfItem.created_at) : undefined;

  const formType = csfItem.form_type || "CSF";
  const scenario = csfItem.scenario || csfItem.tenant || "";
  const title = `${formType} • ${scenario}`.trim().substring(0, 60);

  return {
    id: `csf:${csfItem.id || "unknown"}`,
    source: VerificationSource.CSF,
    status,
    risk,
    created_at: csfItem.created_at || new Date().toISOString(),
    jurisdiction: csfItem.jurisdiction,
    reason_code: normalizedReasonCode,
    title,
    summary: csfItem.summary || title,
    link: {
      label: "Open in Compliance Console",
      href: `/console`, // TODO: Add specific CSF route when available
    },
    artifact: {
      type: "CSF_SUBMISSION",
      artifact_id: csfItem.id?.toString(),
    },
    trace: {
      trace_id: csfItem.trace_id,
    },
    metrics,
  };
}

// ============================================================================
// Mapper: License Artifact -> Verification Work Event (STUB)
// ============================================================================

/**
 * Converts a License check to a Verification Work Event
 * 
 * TODO: Wire up when License verification queue is available
 * Expected input shape (to be defined):
 * - id: string/number
 * - license_type: "TDDD" | "DEA" | "NY_PHARMACY" | etc.
 * - status: "active" | "expired" | "pending" | "blocked"
 * - created_at: string
 * - jurisdiction: string
 */
export function fromLicenseArtifact(licenseItem: any): VerificationWorkEvent {
  const normalizedReasonCode = normalizeReasonCode(licenseItem.reason_code);
  const risk = inferRiskLevel({
    source: VerificationSource.LICENSE,
    reason_code: normalizedReasonCode,
  });

  // Map license-specific status
  let status = VerificationWorkStatus.OPEN;
  if (licenseItem.status === "active" || licenseItem.status === "license_active") {
    status = VerificationWorkStatus.RESOLVED;
  } else if (licenseItem.status === "expired" || licenseItem.status === "blocked") {
    status = VerificationWorkStatus.BLOCKED;
  }

  const metrics = licenseItem.created_at ? calculateAgeMetrics(licenseItem.created_at) : undefined;

  const licenseType = licenseItem.license_type || "License";
  const jurisdiction = licenseItem.jurisdiction || "";
  const title = `${licenseType} • ${jurisdiction}`.trim().substring(0, 60);

  return {
    id: `license:${licenseItem.id || "unknown"}`,
    source: VerificationSource.LICENSE,
    status,
    risk,
    created_at: licenseItem.created_at || new Date().toISOString(),
    jurisdiction: licenseItem.jurisdiction,
    reason_code: normalizedReasonCode,
    title,
    summary: licenseItem.summary || title,
    link: {
      label: "Open in Compliance Console",
      href: `/license`, // TODO: Add specific license route when available
    },
    artifact: {
      type: "LICENSE_CHECK",
      artifact_id: licenseItem.id?.toString(),
    },
    trace: {
      trace_id: licenseItem.trace_id,
    },
    metrics,
  };
}

// ============================================================================
// Aggregate Helper
// ============================================================================

/**
 * Aggregates verification work events by source and computes counts
 */
export function aggregateBySource(events: VerificationWorkEvent[]): {
  [key in VerificationSource]: {
    total: number;
    open: number;
    high_risk: number;
    over_24h: number;
  };
} {
  const result = {
    [VerificationSource.CHAT]: { total: 0, open: 0, high_risk: 0, over_24h: 0 },
    [VerificationSource.CSF]: { total: 0, open: 0, high_risk: 0, over_24h: 0 },
    [VerificationSource.LICENSE]: { total: 0, open: 0, high_risk: 0, over_24h: 0 },
    [VerificationSource.SYSTEM]: { total: 0, open: 0, high_risk: 0, over_24h: 0 },
  };

  events.forEach((event) => {
    const bucket = result[event.source];
    bucket.total++;

    if (event.status === VerificationWorkStatus.OPEN) {
      bucket.open++;
    }

    if (event.risk === RiskLevel.HIGH) {
      bucket.high_risk++;
    }

    if (event.metrics?.sla_bucket === "OVER_24H") {
      bucket.over_24h++;
    }
  });

  return result;
}
