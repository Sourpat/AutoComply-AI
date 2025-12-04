// src/api/csfResearcherClient.ts
import { ResearcherCsfDecision, ResearcherCsfFormData } from "../domain/csfResearcher";
import { API_BASE } from "./csfHospitalClient";

export async function evaluateResearcherCsf(
  form: ResearcherCsfFormData
): Promise<ResearcherCsfDecision> {
  const resp = await fetch(`${API_BASE}/csf/researcher/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
    const message = await resp.text();
    throw new Error(
      `Researcher CSF evaluation failed with status ${resp.status}: ${message}`
    );
  }

  const data = await resp.json();
  const decision = (data?.decision ?? data) as ResearcherCsfDecision;

  return {
    ...decision,
    regulatory_references: decision.regulatory_references ?? [],
    missing_fields: decision.missing_fields ?? [],
  };
}
