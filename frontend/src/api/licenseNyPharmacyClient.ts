import { API_BASE } from "./csfHospitalClient";
import { NyPharmacyDecision, NyPharmacyFormData } from "../domain/licenseNyPharmacy";
import { OhioTdddFormCopilotResponse as LicenseCopilotResponse } from "../domain/licenseOhioTddd";

export async function evaluateNyPharmacyLicense(
  form: NyPharmacyFormData
): Promise<NyPharmacyDecision> {
  const resp = await fetch(`${API_BASE}/license/ny-pharmacy/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pharmacy_name: form.pharmacyName,
      account_number: form.accountNumber,
      ship_to_state: form.shipToState,
      dea_number: form.deaNumber ?? null,
      ny_state_license_number: form.nyStateLicenseNumber,
      attestation_accepted: form.attestationAccepted,
      internal_notes: form.internalNotes ?? "",
    }),
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(
      `NY Pharmacy license evaluation failed with status ${resp.status}: ${message}`
    );
  }

  const data = await resp.json();
  const decision = (data?.decision ?? data) as NyPharmacyDecision;

  return {
    ...decision,
    regulatory_references: decision.regulatory_references ?? [],
    missingFields: decision.missingFields ?? (decision as any).missing_fields ?? [],
  } as NyPharmacyDecision;
}

export async function callNyPharmacyFormCopilot(
  form: NyPharmacyFormData
): Promise<LicenseCopilotResponse> {
  const resp = await fetch(`${API_BASE}/license/ny-pharmacy/form-copilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pharmacy_name: form.pharmacyName,
      account_number: form.accountNumber,
      ship_to_state: form.shipToState,
      dea_number: form.deaNumber ?? null,
      ny_state_license_number: form.nyStateLicenseNumber,
      attestation_accepted: form.attestationAccepted,
      internal_notes: form.internalNotes ?? "",
    }),
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(
      `NY Pharmacy License Copilot failed with status ${resp.status}: ${message}`
    );
  }

  return (await resp.json()) as LicenseCopilotResponse;
}
