// src/api/csfEmsCopilotClient.ts
import { API_BASE } from "../lib/api";
import { EmsCsfFormData } from "../domain/csfEms";
import type { CsfCopilotResponse } from "../types/csfCopilot";

export async function callEmsFormCopilot(
  form: EmsCsfFormData
): Promise<CsfCopilotResponse> {
  const resp = await fetch(`${API_BASE}/csf/ems/form-copilot`, {
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
      `EMS Form Copilot failed with status ${resp.status}: ${message || "no error details"}`
    );
  }

  return (await resp.json()) as CsfCopilotResponse;
}
