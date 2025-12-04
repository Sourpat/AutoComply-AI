import type { DecisionOutcome } from "../types/decision";

export interface NyPharmacyFormData {
  pharmacyName: string;
  accountNumber: string;
  shipToState: string; // should normally be "NY"
  deaNumber?: string;
  nyStateLicenseNumber: string;
  attestationAccepted: boolean;
  internalNotes?: string;
}

export interface NyPharmacyDecision extends DecisionOutcome {
  missingFields?: string[];
}
