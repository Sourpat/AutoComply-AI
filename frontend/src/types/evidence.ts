/**
 * Evidence Types
 * 
 * Shared types for regulatory evidence items.
 * Step 2.5: Evidence Drilldown Drawer + Packet Inclusion Controls
 */

export interface EvidenceItem {
  id: string;
  label: string;
  jurisdiction?: string;
  citation?: string;
  snippet?: string;
  tags?: string[];
  effectiveDate?: string;
  sourceUrl?: string;
  decisionType?: string;
}
