import type { ResearcherCsfFormData } from "./csfResearcher";

export type ResearcherCsfPresetId =
  | "csf-researcher-complete"
  | "csf-researcher-missing-info"
  | "csf-researcher-high-risk";

export interface ResearcherCsfPreset {
  id: ResearcherCsfPresetId;
  label: string;
  description: string;
  verticalLabel?: string;
  group?: string;
  form: ResearcherCsfFormData;
}

const BASE_RESEARCHER: Omit<ResearcherCsfFormData, "controlledSubstances"> = {
  facilityName: "University Research Lab – MA",
  facilityType: "researcher",
  accountNumber: "910123456",
  pharmacyLicenseNumber: "MA-RES-2025-001",
  deaNumber: "RS1234567",
  pharmacistInChargeName: "Dr. Dana Example",
  pharmacistContactPhone: "555-400-9001",
  shipToState: "MA",
  attestationAccepted: true,
  internalNotes: "Researcher CSF preset from Compliance Console",
};

export const RESEARCHER_CSF_PRESETS: ResearcherCsfPreset[] = [
  {
    id: "csf-researcher-complete",
    label: "Researcher CSF – complete & controlled",
    description:
      "All research identifiers and controls provided; expected to be ok_to_ship.",
    verticalLabel: "Researcher CSF vertical",
    group: "Vertical demos",
    form: {
      ...BASE_RESEARCHER,
      controlledSubstances: [
        { id: "fentanyl", name: "Fentanyl" },
        { id: "ketamine", name: "Ketamine" },
      ],
    },
  },
  {
    id: "csf-researcher-missing-info",
    label: "Researcher CSF – missing critical info",
    description:
      "Missing protocol or oversight signals; should trigger needs_review or blocked.",
    verticalLabel: "Researcher CSF vertical",
    group: "Vertical demos",
    form: {
      ...BASE_RESEARCHER,
      pharmacyLicenseNumber: "",
      deaNumber: "",
      internalNotes:
        "Missing protocol identifiers and DEA/license information for the research lab.",
      controlledSubstances: [{ id: "morphine", name: "Morphine" }],
    },
  },
  {
    id: "csf-researcher-high-risk",
    label: "Researcher CSF – red flag responses",
    description:
      "Answers suggest unacceptable research use or diversion risk; expect blocked.",
    verticalLabel: "Researcher CSF vertical",
    group: "Vertical demos",
    form: {
      ...BASE_RESEARCHER,
      attestationAccepted: false,
      internalNotes:
        "Research plan lacks oversight and declines attestation; treated as high-risk.",
      controlledSubstances: [{ id: "oxycodone", name: "Oxycodone" }],
    },
  },
];
