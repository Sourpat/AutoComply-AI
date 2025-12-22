// src/api/csfResearcherClient.ts
import { apiFetch } from "../lib/api";
import { ResearcherCsfDecision, ResearcherCsfFormData } from "../domain/csfResearcher";

export async function evaluateResearcherCsf(
  form: ResearcherCsfFormData
): Promise<ResearcherCsfDecision> {
  const payload = {
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
  };

  const data = await apiFetch<any>("/csf/researcher/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const decision = (data?.decision ?? data) as ResearcherCsfDecision;

  return {
    ...decision,
    regulatory_references: decision.regulatory_references ?? [],
    missing_fields: decision.missing_fields ?? [],
  };
}
