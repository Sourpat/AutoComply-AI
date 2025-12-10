import type { HospitalCsfFormData, HospitalFacilityType } from "./csfHospital";

export type HospitalCsfPresetId =
  | "ohio_schedule_ii_happy_path"
  | "missing_dea_needs_review"
  | "wrong_state_blocked";

export interface HospitalCsfPreset {
  id: HospitalCsfPresetId;
  label: string;
  description: string;
  form: HospitalCsfFormData;
}

const BASE_OHIO_HOSPITAL: Omit<HospitalCsfFormData, "controlledSubstances"> = {
  facilityName: "Ohio General Hospital",
  facilityType: "hospital" as HospitalFacilityType,
  accountNumber: "ACC-OH-HOSP-001",
  pharmacyLicenseNumber: "OH-PHARM-123456",
  deaNumber: "DEA-1234567",
  pharmacistInChargeName: "Dr. Compliance",
  pharmacistContactPhone: "555-1212",
  shipToState: "OH",
  attestationAccepted: true,
  internalNotes: "Preset from Compliance Console",
};

export const HOSPITAL_CSF_PRESETS: HospitalCsfPreset[] = [
  {
    id: "ohio_schedule_ii_happy_path",
    label: "Happy path – Ohio Schedule II",
    description: "Valid hospital CSF with Schedule II drugs shipping to OH.",
    form: {
      ...BASE_OHIO_HOSPITAL,
      controlledSubstances: [
        {
          id: "ohio-happy-oxycodone",
          ndc: "12345-6789-01",
          name: "Oxycodone 5mg",
          schedule: "II",
        },
      ],
    },
  },
  {
    id: "missing_dea_needs_review",
    label: "Missing DEA – needs review",
    description:
      "Hospital license looks okay but DEA is missing: triggers needs_review.",
    form: {
      ...BASE_OHIO_HOSPITAL,
      deaNumber: "",
      controlledSubstances: [
        {
          id: "ohio-missing-dea-morphine",
          ndc: "98765-4321-01",
          name: "Morphine 10mg",
          schedule: "II",
        },
      ],
    },
  },
  {
    id: "wrong_state_blocked",
    label: "Wrong ship-to state – blocked",
    description:
      "Hospital is configured for OH but ship-to is a non-supported state.",
    form: {
      ...BASE_OHIO_HOSPITAL,
      shipToState: "CA",
      controlledSubstances: [
        {
          id: "ohio-wrong-state-hydromorphone",
          ndc: "55555-1111-01",
          name: "Hydromorphone 2mg",
          schedule: "II",
        },
      ],
    },
  },
];
