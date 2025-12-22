// src/api/csfPractitionerClient.ts
import { apiFetch } from "../lib/api";
import {
  PractitionerCsfDecision,
  PractitionerCsfFormData,
} from "../domain/csfPractitioner";

export async function evaluatePractitionerCsf(
  form: PractitionerCsfFormData
): Promise<PractitionerCsfDecision> {
  const payload = {
    facility_name: form.facilityName,
    facility_type: form.facilityType,
    account_number: form.accountNumber ?? null,
    practitioner_name: form.practitionerName,
    state_license_number: form.stateLicenseNumber,
    dea_number: form.deaNumber,
    ship_to_state: form.shipToState,
    attestation_accepted: form.attestationAccepted,
    internal_notes: form.internalNotes ?? null,
  };

  const data = await apiFetch<any>("/csf/practitioner/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const decision = (data?.decision ?? data) as PractitionerCsfDecision;

  return {
    ...decision,
    regulatory_references: decision.regulatory_references ?? [],
    missing_fields: decision.missing_fields ?? [],
  };
}
