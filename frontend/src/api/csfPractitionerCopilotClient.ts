// src/api/csfPractitionerCopilotClient.ts
import { API_BASE } from "./csfHospitalClient";
import {
  PractitionerCsfFormData,
  PractitionerFormCopilotResponse,
} from "../domain/csfPractitioner";

export async function callPractitionerFormCopilot(
  form: PractitionerCsfFormData,
  controlledSubstances: any[] = []
): Promise<PractitionerFormCopilotResponse> {
  const resp = await fetch(`${API_BASE}/csf/practitioner/form-copilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      controlled_substances: controlledSubstances,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    const message = text ? `${resp.status}: ${text}` : `${resp.status}`;
    throw new Error(`Practitioner Form Copilot failed with status ${message}`);
  }

  const data: PractitionerFormCopilotResponse = await resp.json();
  return data;
}
