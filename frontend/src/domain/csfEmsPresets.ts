import type { EmsCsfFormData } from "./csfEms";

export type EmsCsfPresetId =
  | "csf-ems-complete"
  | "csf-ems-missing-info"
  | "csf-ems-high-risk";

export interface EmsCsfPreset {
  id: EmsCsfPresetId;
  label: string;
  description: string;
  verticalLabel?: string;
  group?: string;
  form: EmsCsfFormData;
}

const BASE_EMS: Omit<EmsCsfFormData, "controlledSubstances"> = {
  facilityName: "Metro EMS – NJ",
  facilityType: "facility",
  accountNumber: "900123456",
  pharmacyLicenseNumber: "NJ-EMS-2025-001",
  deaNumber: "EM1234567",
  pharmacistInChargeName: "Dr. EMS Director",
  pharmacistContactPhone: "555-300-9001",
  shipToState: "NJ",
  attestationAccepted: true,
  internalNotes: "EMS CSF preset from Compliance Console",
};

export const EMS_CSF_PRESETS: EmsCsfPreset[] = [
  {
    id: "csf-ems-complete",
    label: "EMS CSF – complete & compliant",
    description:
      "All EMS identifiers provided with clear storage and transport practices; expect ok_to_ship.",
    verticalLabel: "EMS CSF vertical",
    group: "Vertical demos",
    form: {
      ...BASE_EMS,
      controlledSubstances: [
        { id: "morphine", name: "Morphine" },
        { id: "fentanyl", name: "Fentanyl" },
      ],
    },
  },
  {
    id: "csf-ems-missing-info",
    label: "EMS CSF – missing critical info",
    description:
      "Key EMS details like DEA or storage descriptions are missing; expect needs_review or blocked.",
    verticalLabel: "EMS CSF vertical",
    group: "Vertical demos",
    form: {
      ...BASE_EMS,
      deaNumber: "",
      internalNotes:
        "Missing DEA number and limited storage details; should prompt review.",
      controlledSubstances: [
        { id: "morphine", name: "Morphine" },
        { id: "fentanyl", name: "Fentanyl" },
      ],
    },
  },
  {
    id: "csf-ems-high-risk",
    label: "EMS CSF – high-risk responses",
    description:
      "Poor controls or declined attestations indicate elevated risk; expect blocked.",
    verticalLabel: "EMS CSF vertical",
    group: "Vertical demos",
    form: {
      ...BASE_EMS,
      pharmacyLicenseNumber: "",
      deaNumber: "",
      attestationAccepted: false,
      internalNotes:
        "No license/DEA and attestation declined – modeled as high-risk for EMS CSF.",
      controlledSubstances: [{ id: "oxycodone", name: "Oxycodone" }],
    },
  },
];
