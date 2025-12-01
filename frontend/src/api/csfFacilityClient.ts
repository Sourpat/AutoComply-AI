// src/api/csfFacilityClient.ts
import { FacilityCsfDecision, FacilityCsfFormData } from "../domain/csfFacility";

const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (import.meta as any)?.env?.VITE_API_BASE_URL ||
  "";

export async function evaluateFacilityCsf(
  form: FacilityCsfFormData
): Promise<FacilityCsfDecision> {
  const resp = await fetch(`${API_BASE}/csf/facility/evaluate`, {
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
    throw new Error(
      `Facility CSF evaluation failed with status ${resp.status}`
    );
  }

  return resp.json();
}
