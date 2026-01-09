/**
 * Coverage Registry
 * 
 * Defines coverage targets and capabilities for each decision type.
 * Used to measure implementation completeness and identify gaps.
 * 
 * Step 2.7: Coverage & Gaps Dashboard
 */

export type DecisionTypeKey = "csf_practitioner" | "ohio_tddd" | "ny_pharmacy_license" | "csf_facility";

export interface CoverageTarget {
  decisionType: DecisionTypeKey;
  label: string;
  description: string;
  targets: {
    expectedRules: number;
    expectedEvidenceSources: number;
    expectedEvidenceTags: string[];
    expectedPlaybookMinSteps: number;
  };
  capabilities: {
    evaluatorImplemented: boolean;
    playbookImplemented: boolean;
    ragSearchAvailable: boolean;
    ragExplainAvailable: boolean;
  };
}

export const coverageTargets: CoverageTarget[] = [
  {
    decisionType: "csf_practitioner",
    label: "DEA CSF Practitioner",
    description: "Individual practitioner (physician, NP, PA) applying for DEA Controlled Substance Facilitator status",
    targets: {
      expectedRules: 12,
      expectedEvidenceSources: 8,
      expectedEvidenceTags: [
        "ohio",
        "tddd",
        "controlled-substances",
        "dea",
        "attestation",
        "practitioner",
        "license",
        "registration",
      ],
      expectedPlaybookMinSteps: 10,
    },
    capabilities: {
      evaluatorImplemented: true,
      playbookImplemented: true,
      ragSearchAvailable: true,
      ragExplainAvailable: true,
    },
  },
  {
    decisionType: "ohio_tddd",
    label: "Ohio TDDD License",
    description: "Ohio Terminal Distributor of Dangerous Drugs license application",
    targets: {
      expectedRules: 10,
      expectedEvidenceSources: 7,
      expectedEvidenceTags: [
        "ohio",
        "tddd",
        "pharmacy",
        "terminal-distributor",
        "controlled-substances",
        "oac-4729",
        "dangerous-drugs",
      ],
      expectedPlaybookMinSteps: 8,
    },
    capabilities: {
      evaluatorImplemented: true,
      playbookImplemented: true,
      ragSearchAvailable: true,
      ragExplainAvailable: true,
    },
  },
  {
    decisionType: "ny_pharmacy_license",
    label: "NY Pharmacy License",
    description: "New York pharmacy license registration and renewal",
    targets: {
      expectedRules: 14,
      expectedEvidenceSources: 10,
      expectedEvidenceTags: [
        "new-york",
        "ny",
        "pharmacy",
        "license",
        "npp",
        "controlled-substances",
        "registration",
        "renewal",
      ],
      expectedPlaybookMinSteps: 9,
    },
    capabilities: {
      evaluatorImplemented: true,
      playbookImplemented: true,
      ragSearchAvailable: true,
      ragExplainAvailable: true,
    },
  },
  {
    decisionType: "csf_facility",
    label: "CSF Facility Application",
    description: "Hospital or healthcare facility applying for DEA Controlled Substance Facilitator status",
    targets: {
      expectedRules: 15,
      expectedEvidenceSources: 12,
      expectedEvidenceTags: [
        "hospital",
        "facility",
        "csf",
        "dea",
        "controlled-substances",
        "storage",
        "security",
        "staffing",
        "compliance",
      ],
      expectedPlaybookMinSteps: 12,
    },
    capabilities: {
      evaluatorImplemented: true,
      playbookImplemented: true,
      ragSearchAvailable: true,
      ragExplainAvailable: true,
    },
  },
];

/**
 * Get coverage target for a specific decision type
 */
export function getCoverageTarget(decisionType: DecisionTypeKey): CoverageTarget | null {
  return coverageTargets.find((t) => t.decisionType === decisionType) || null;
}

/**
 * Get all decision types with coverage tracking
 */
export function getAllDecisionTypes(): DecisionTypeKey[] {
  return coverageTargets.map((t) => t.decisionType);
}
