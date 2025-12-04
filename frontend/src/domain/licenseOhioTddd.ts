import type { DecisionOutcome } from "../types/decision";
import type { CsfCopilotResponse } from "../types/csfCopilot";

export interface OhioTdddFormData {
  tdddNumber: string;
  facilityName: string;
  accountNumber?: string;
  shipToState: string;
  licenseType: string; // always "ohio_tddd"
  attestationAccepted: boolean;
  internalNotes?: string;
}

export interface OhioTdddDecision extends DecisionOutcome {
  missingFields: string[];
}

export type OhioTdddFormCopilotResponse = CsfCopilotResponse;
