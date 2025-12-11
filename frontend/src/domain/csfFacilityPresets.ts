import type { FacilityCsfFormData, FacilityFacilityType } from "./csfFacility";

export type FacilityCsfPresetId =
  | "ohio_hospital_facility_happy_path"
  | "missing_dea_needs_review"
  | "wrong_state_blocked";

export interface FacilityCsfPreset {
  id: FacilityCsfPresetId;
  label: string;
  description: string;
  verticalLabel?: string;
  group?: string;
  form: FacilityCsfFormData;
}

const BASE_OHIO_FACILITY: Omit<
  FacilityCsfFormData,
  "controlledSubstances"
> = {
  facilityName: "Ohio Hospital Outpatient Pharmacy",
  facilityType: "facility" as FacilityFacilityType,
  accountNumber: "ACC-OH-FAC-001",
  pharmacyLicenseNumber: "OH-FAC-987654",
  deaNumber: "DEA-FAC-1234567",
  pharmacistInChargeName: "Dr. Facility Lead",
  pharmacistContactPhone: "555-4545",
  shipToState: "OH",
  attestationAccepted: true,
  internalNotes: "Preset from Compliance Console",
};

export const FACILITY_CSF_PRESETS: FacilityCsfPreset[] = [
  {
    id: "ohio_hospital_facility_happy_path",
    label: "Happy path – Ohio facility",
    description: "Valid facility CSF with Schedule II drug shipping to Ohio.",
    verticalLabel: "Facility CSF vertical",
    group: "Vertical demos",
    form: {
      ...BASE_OHIO_FACILITY,
      controlledSubstances: [
        {
          id: "facility-ohio-oxycodone",
          ndc: "22222-3333-01",
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
      "Facility looks valid but DEA number is missing; should trigger needs_review.",
    verticalLabel: "Facility CSF vertical",
    group: "Vertical demos",
    form: {
      ...BASE_OHIO_FACILITY,
      deaNumber: "",
      controlledSubstances: [
        {
          id: "facility-missing-dea-hydromorphone",
          ndc: "44444-5555-01",
          name: "Hydromorphone 2mg",
          schedule: "II",
        },
      ],
    },
  },
  {
    id: "wrong_state_blocked",
    label: "Wrong ship-to state – blocked",
    description:
      "Facility configured for Ohio but ship-to is a non-supported state.",
    verticalLabel: "Facility CSF vertical",
    group: "Vertical demos",
    form: {
      ...BASE_OHIO_FACILITY,
      shipToState: "CA",
      controlledSubstances: [
        {
          id: "facility-wrong-state-morphine",
          ndc: "77777-8888-01",
          name: "Morphine 10mg",
          schedule: "II",
        },
      ],
    },
  },
];
