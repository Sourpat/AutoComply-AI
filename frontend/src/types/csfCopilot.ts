// src/types/csfCopilot.ts

import type { RegulatoryReference, DecisionStatus } from "./decision";

export interface CsfCopilotSuggestion {
  field_name: string;
  suggested_value?: unknown;
  rationale?: string | null;
}

// Mirrors backend CsfCopilotResponse (with legacy flat fields)
export interface CsfCopilotResponse {
  // Legacy / flat fields
  status?: DecisionStatus;
  reason?: string;
  rag_explanation?: string;
  artifacts_used: string[];
  rag_sources: Array<Record<string, unknown>>;

  // Guidance schema
  missing_fields: string[];
  suggestions: CsfCopilotSuggestion[];
  message?: string | null;

  // Unified regulatory model
  regulatory_references: RegulatoryReference[];

  // Debug / tracing
  debug_info?: Record<string, unknown> | null;
  trace_id?: string | null;
}
