import type { PractitionerCsfFormData } from "./csfPractitioner";

export type PractitionerCsfPresetId =
  | "ohio_schedule_ii_happy_path"
  | "missing_state_license_needs_review"
  | "high_quantity_edge_case";

export interface PractitionerCsfPreset {
  id: PractitionerCsfPresetId;
  label: string;
  description: string;
  form: PractitionerCsfFormData;
}

const BASE_OHIO_PRACTITIONER: Omit<
  PractitionerCsfFormData,
  "controlledSubstances"
> = {
  facilityName: "Compliance Care Clinic",
  facilityType: "individual_practitioner",
  accountNumber: "ACC-OH-PRAC-001",
  practitionerName: "Dr. Compliance Practitioner",
  stateLicenseNumber: "OH-MD-123456",
  deaNumber: "DEA-PRAC-7654321",
  shipToState: "OH",
  attestationAccepted: true,
  internalNotes: "Preset from Compliance Console",
};

export const PRACTITIONER_CSF_PRESETS: PractitionerCsfPreset[] = [
  {
    id: "ohio_schedule_ii_happy_path",
    label: "Happy path – Ohio Schedule II",
    description:
      "Valid practitioner CSF with Schedule II drug shipping to OH.",
    form: {
      ...BASE_OHIO_PRACTITIONER,
      controlledSubstances: [
        {
          id: "cs_11111_2222_01",
          ndc: "11111-2222-01",
          name: "Oxycodone 5mg",
          schedule: "II",
          dea_schedule: "II",
        },
      ],
    },
  },
  {
    id: "missing_state_license_needs_review",
    label: "Missing state license – needs review",
    description:
      "DEA is present but state license is missing; should trigger needs_review.",
    form: {
      ...BASE_OHIO_PRACTITIONER,
      stateLicenseNumber: "",
      controlledSubstances: [
        {
          id: "cs_33333_4444_01",
          ndc: "33333-4444-01",
          name: "Hydrocodone/APAP 5/325",
          schedule: "II",
          dea_schedule: "II",
        },
      ],
    },
  },
  {
    id: "high_quantity_edge_case",
    label: "High quantity – edge case",
    description:
      "Unusually high quantity of a Schedule II drug to highlight edge-case logic.",
    form: {
      ...BASE_OHIO_PRACTITIONER,
      controlledSubstances: [
        {
          id: "cs_55555_6666_01",
          ndc: "55555-6666-01",
          name: "Morphine 15mg",
          schedule: "II",
          dea_schedule: "II",
        },
      ],
    },
  },
];
