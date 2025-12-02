import { OhioTdddFormData } from "./licenseOhioTddd";
import { HospitalCsfFormData } from "./csfHospital";

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
