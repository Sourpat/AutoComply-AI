import { OhioTdddFormData } from "./licenseOhioTddd";
import { HospitalCsfFormData } from "./csfHospital";
import { FacilityCsfFormData } from "./csfFacility";
import { PractitionerCsfFormData } from "./csfPractitioner";

export function mapHospitalFormToOhioTddd(
  hospitalForm: HospitalCsfFormData
): OhioTdddFormData {
  return {
    tdddNumber:
      (hospitalForm as any).ohioTdddNumber ??
      "" /* TODO: wire to explicit Ohio TDDD field if/when added */,
    facilityName: hospitalForm.facilityName || "Unknown hospital facility",
    accountNumber: hospitalForm.accountNumber ?? "",
    shipToState: hospitalForm.shipToState ?? "",
    licenseType: "ohio_tddd",
    attestationAccepted:
      hospitalForm.attestationAccepted ??
      true /* assume accepted if not modeled */,
    internalNotes:
      hospitalForm.internalNotes ??
      "Derived from Hospital CSF Sandbox form for Ohio TDDD license check.",
  };
}

export function mapFacilityFormToOhioTddd(
  facilityForm: FacilityCsfFormData
): OhioTdddFormData {
  return {
    tdddNumber:
      (facilityForm as any).ohioTdddNumber ??
      "" /* TODO: wire to explicit Ohio TDDD field if/when added */,
    facilityName:
      (facilityForm as any).facilityName ??
      (facilityForm as any).surgeryCenterName ??
      "Unknown facility",
    accountNumber: facilityForm.accountNumber ?? "",
    shipToState: facilityForm.shipToState ?? "",
    licenseType: "ohio_tddd",
    attestationAccepted:
      facilityForm.attestationAccepted ??
      true /* assume accepted if not modeled */,
    internalNotes:
      "Derived from Facility CSF Sandbox form for Ohio TDDD license check.",
  };
}

export function mapPractitionerFormToOhioTddd(
  practitionerForm: PractitionerCsfFormData
): OhioTdddFormData {
  return {
    tdddNumber:
      (practitionerForm as any).ohioTdddNumber ??
      "" /* TODO: wire to explicit Ohio TDDD field if/when added */,
    facilityName:
      practitionerForm.facilityName ??
      (practitionerForm as any).practitionerName ??
      "Unknown practitioner practice",
    accountNumber: practitionerForm.accountNumber ?? "",
    shipToState: practitionerForm.shipToState ?? "",
    licenseType: "ohio_tddd",
    attestationAccepted:
      practitionerForm.attestationAccepted ??
      true,
    internalNotes:
      "Derived from Practitioner CSF Sandbox form for Ohio TDDD license check.",
  };
}
