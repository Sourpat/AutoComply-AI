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
