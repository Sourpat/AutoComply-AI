export interface RegulatoryPreviewItem {
  id: string;
  jurisdiction?: string | null;
  source?: string | null;
  citation?: string | null;
  label?: string | null;
  snippet?: string | null;
}

export interface RegulatoryPreviewResponse {
  items: RegulatoryPreviewItem[];
}
