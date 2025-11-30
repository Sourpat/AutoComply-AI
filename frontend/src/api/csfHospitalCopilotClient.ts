// src/api/csfHospitalCopilotClient.ts
import { HospitalCsfDecisionStatus, HospitalCsfFormData } from "../domain/csfHospital";
import type { RegulatorySource } from "./csfExplainClient";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || process.env.VITE_API_BASE || "";

export interface HospitalFormCopilotResponse {
  status: HospitalCsfDecisionStatus;
  reason: string;
  missing_fields: string[];
  regulatory_references: string[];
  rag_explanation: string;
  artifacts_used: string[];
  rag_sources: RegulatorySource[];
}

export async function callHospitalFormCopilot(
  form: HospitalCsfFormData
): Promise<HospitalFormCopilotResponse> {
  const resp = await fetch(`${API_BASE}/csf/hospital/form-copilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      facility_name: form.facilityName,
      facility_type: form.facilityType,
      account_number: form.accountNumber ?? null,
      pharmacy_license_number: form.pharmacyLicenseNumber,
      dea_number: form.deaNumber,
      pharmacist_in_charge_name: form.pharmacistInChargeName,
      pharmacist_contact_phone: form.pharmacistContactPhone ?? null,
      ship_to_state: form.shipToState,
      attestation_accepted: form.attestationAccepted,
      internal_notes: form.internalNotes ?? null,
      controlled_substances: form.controlledSubstances ?? [],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const message = text ? `${resp.status}: ${text}` : `${resp.status}`;
    throw new Error(`Hospital Form Copilot failed with status ${message}`);
  }

  return resp.json();
}
