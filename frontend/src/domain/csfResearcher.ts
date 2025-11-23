// src/domain/csfResearcher.ts
import { ControlledSubstanceItem } from "./controlledSubstances";

export type ResearchFacilityType =
  | "university"
  | "hospital_research"
  | "private_lab"
  | "pharma_rnd"
  | "other";

export interface ResearcherCsfFormData {
  institutionName: string;
  facilityType: ResearchFacilityType;
  accountNumber?: string | null;

  principalInvestigatorName: string;
  researcherTitle?: string | null;

  stateLicenseNumber?: string | null;
  deaNumber?: string | null;
  protocolOrStudyId: string;

  shipToState: string;

  attestationAccepted: boolean;

  internalNotes?: string | null;

  // NEW: attached controlled substances
  controlledSubstances?: ControlledSubstanceItem[];
}

export type ResearcherCsfDecisionStatus =
  | "ok_to_ship"
  | "blocked"
  | "manual_review";

export interface ResearcherCsfDecision {
  status: ResearcherCsfDecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
}
