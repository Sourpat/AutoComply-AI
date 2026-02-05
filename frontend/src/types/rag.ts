export interface RagSource {
  id?: string;
  label?: string;
  jurisdiction?: string; // "DEA", "Ohio", "NY", etc.
  citation?: string; // "OAC 4729:5-3-10", "21 CFR 1306", etc.
  snippet: string; // short text excerpt
  score: number; // normalized [0.0, 1.0]
  raw_score?: number; // backend raw retriever score
  url?: string; // origin URL, if any
  source_type?: string; // "statute", "policy", "internal", etc.
}

export interface RagSearchResponse {
  query: string;
  sources: RagSource[];
}

export interface RegulatoryPreviewItem extends Partial<RagSource> {
  id: string;
  source?: string | null;
  snippet?: string | null;
}

export interface RegulatoryPreviewResponse {
  items: RegulatoryPreviewItem[];
}

export type ExplainStatus = "approved" | "needs_review" | "blocked";
export type ExplainRiskLevel = "low" | "medium" | "high";
export type ExplainFieldCategory = "BLOCK" | "REVIEW" | "INFO";

export interface ExplainMissingField {
  key: string;
  label: string;
  category: ExplainFieldCategory;
  path?: string | null;
  reason?: string | null;
}

export interface ExplainFiredRule {
  id: string;
  name: string;
  severity: ExplainFieldCategory;
  rationale: string;
  inputs: Record<string, string>;
  conditions?: Record<string, string> | null;
}

export interface ExplainCitation {
  doc_id: string;
  chunk_id: string;
  snippet: string;
  jurisdiction?: string | null;
  confidence?: number | null;
  source_title?: string | null;
  url?: string | null;
}

export interface ExplainNextStep {
  action: string;
  blocking: boolean;
  rationale?: string | null;
}

export interface ExplainResult {
  run_id: string;
  submission_id: string;
  submission_hash: string;
  policy_version: string;
  knowledge_version: string;
  status: ExplainStatus;
  risk: ExplainRiskLevel;
  summary: string;
  missing_fields: ExplainMissingField[];
  fired_rules: ExplainFiredRule[];
  citations: ExplainCitation[];
  next_steps: ExplainNextStep[];
  debug?: Record<string, string> | null;
}
