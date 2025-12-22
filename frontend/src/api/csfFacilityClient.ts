// src/api/csfFacilityClient.ts
import { apiFetch } from "../lib/api";
import { FacilityCsfDecision, FacilityCsfFormData } from "../domain/csfFacility";

export async function evaluateFacilityCsf(
  form: FacilityCsfFormData
): Promise<FacilityCsfDecision> {
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

  const data = await apiFetch<any>("/csf/facility/evaluate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const decision = (data?.decision ?? data) as FacilityCsfDecision;

  return {
    ...decision,
    regulatory_references: decision.regulatory_references ?? [],
    missing_fields: decision.missing_fields ?? [],
  };
}
