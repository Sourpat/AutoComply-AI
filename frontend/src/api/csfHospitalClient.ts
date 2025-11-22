// src/api/csfHospitalClient.ts
import {
  HospitalCsfDecision,
  HospitalCsfFormData,
} from "../domain/csfHospital";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  "";

export async function evaluateHospitalCsf(
  form: HospitalCsfFormData
): Promise<HospitalCsfDecision> {
  const resp = await fetch(`${API_BASE}/csf/hospital/evaluate`, {
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
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `Hospital CSF evaluation failed with status ${resp.status}`
    );
  }

  return resp.json();
}
