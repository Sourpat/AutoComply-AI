// src/api/csfHospitalClient.ts
import {
  HospitalCsfDecision,
  HospitalCsfFormData,
} from "../domain/csfHospital";
import { apiFetch } from "../lib/api";

export async function evaluateHospitalCsf(
  form: HospitalCsfFormData | Record<string, any>
): Promise<HospitalCsfDecision> {
  // Check if form is already transformed (has snake_case keys)
  const isTransformed = 'facility_name' in form;
  
  const payload = isTransformed
    ? form // Already transformed by caller
    : {
        // Transform camelCase to snake_case
        facility_name: (form as HospitalCsfFormData).facilityName,
        facility_type: (form as HospitalCsfFormData).facilityType,
        account_number: (form as HospitalCsfFormData).accountNumber ?? null,
        pharmacy_license_number: (form as HospitalCsfFormData).pharmacyLicenseNumber,
        dea_number: (form as HospitalCsfFormData).deaNumber,
        pharmacist_in_charge_name: (form as HospitalCsfFormData).pharmacistInChargeName,
        pharmacist_contact_phone: (form as HospitalCsfFormData).pharmacistContactPhone ?? null,
        ship_to_state: (form as HospitalCsfFormData).shipToState,
        attestation_accepted: (form as HospitalCsfFormData).attestationAccepted,
        internal_notes: (form as HospitalCsfFormData).internalNotes ?? null,
        controlled_substances: (form as HospitalCsfFormData).controlledSubstances ?? [],
      };

  const data = await apiFetch<any>("/csf/hospital/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const decision = (data?.decision ?? data) as HospitalCsfDecision;

  return {
    ...decision,
    regulatory_references: decision.regulatory_references ?? [],
    missing_fields: decision.missing_fields ?? [],
  };
}
