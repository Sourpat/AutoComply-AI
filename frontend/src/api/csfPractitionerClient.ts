// src/api/csfPractitionerClient.ts
import {
  PractitionerCsfDecision,
  PractitionerCsfFormData,
} from "../domain/csfPractitioner";

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  "";

export async function evaluatePractitionerCsf(
  form: PractitionerCsfFormData
): Promise<PractitionerCsfDecision> {
  const resp = await fetch(`${API_BASE}/csf/practitioner/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      facility_name: form.facilityName,
      facility_type: form.facilityType,
      account_number: form.accountNumber ?? null,
      practitioner_name: form.practitionerName,
      state_license_number: form.stateLicenseNumber,
      dea_number: form.deaNumber,
      ship_to_state: form.shipToState,
      attestation_accepted: form.attestationAccepted,
      internal_notes: form.internalNotes ?? null,
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `Practitioner CSF evaluation failed with status ${resp.status}`
    );
  }

  const data = await resp.json();
  const decision = (data?.decision ?? data) as PractitionerCsfDecision;

  return {
    ...decision,
    regulatory_references: decision.regulatory_references ?? [],
    missing_fields: decision.missing_fields ?? [],
  };
}
