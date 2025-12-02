import { API_BASE } from "./csfHospitalClient";
import { NyPharmacyFormData } from "../domain/licenseNyPharmacy";
import { NyPharmacyOrderApprovalResult } from "../domain/orderMockApproval";

export interface NyPharmacyOrderMockRun {
  request: { ny_pharmacy: any };
  response: NyPharmacyOrderApprovalResult;
}

export async function runNyPharmacyOrderMock(
  form: NyPharmacyFormData
): Promise<NyPharmacyOrderMockRun> {
  const requestBody = {
    ny_pharmacy: {
      pharmacy_name: form.pharmacyName,
      account_number: form.accountNumber,
      ship_to_state: form.shipToState,
      dea_number: form.deaNumber ?? null,
      ny_state_license_number: form.nyStateLicenseNumber,
      attestation_accepted: form.attestationAccepted,
      internal_notes: form.internalNotes ?? "",
    },
  };

  const resp = await fetch(`${API_BASE}/orders/mock/ny-pharmacy-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(
      `NY Pharmacy mock order approval failed with status ${resp.status}: ${message}`
    );
  }

  const json = (await resp.json()) as NyPharmacyOrderApprovalResult;

  return {
    request: requestBody,
    response: json,
  };
}
