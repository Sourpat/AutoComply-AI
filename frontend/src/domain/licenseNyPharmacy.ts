export interface NyPharmacyFormData {
  pharmacyName: string;
  accountNumber: string;
  shipToState: string; // should normally be "NY"
  deaNumber?: string;
  nyStateLicenseNumber: string;
  attestationAccepted: boolean;
  internalNotes?: string;
}

export interface NyPharmacyDecision {
  status: "ok_to_ship" | "needs_review" | "blocked";
  reason: string;
  missingFields: string[];
}
