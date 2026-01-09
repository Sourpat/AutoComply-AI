/**
 * Mock decision scenarios for CSF Practitioner evaluator
 * 
 * These mirror the backend scenarios in csf_practitioner_evaluator.py
 */

export interface MockScenario {
  id: string;
  name: string;
  description: string;
  decision_type: string;
  engine_family: string;
  evidence: Record<string, any>;
}

export function get_mock_scenarios(): MockScenario[] {
  return [
    {
      id: "blocked",
      name: "BLOCKED - Missing DEA Registration",
      description: "Practitioner has no valid DEA registration",
      decision_type: "csf_practitioner",
      engine_family: "csf",
      evidence: {
        dea_registration: false,  // BLOCKING
        dea_expiry_days: 0,
        state_license_status: "Active",
        state_license_expiry_days: 180,
        authorized_schedules: [],
        requested_schedules: ["II", "III", "IV", "V"],
        has_prior_violations: false,
        telemedicine_practice: false,
        has_ryan_haight_attestation: false,
        multi_state: false,
        documented_jurisdictions: ["OH"],
        has_npi: true,
      }
    },
    {
      id: "needs_review",
      name: "NEEDS REVIEW - DEA Expiring Soon + Telemedicine Missing Attestation",
      description: "Valid credentials but DEA expires in 20 days and missing Ryan Haight attestation",
      decision_type: "csf_practitioner",
      engine_family: "csf",
      evidence: {
        dea_registration: true,
        dea_expiry_days: 20,  // REVIEW - less than 30 days
        state_license_status: "Active",
        state_license_expiry_days: 365,
        authorized_schedules: ["II", "III", "IV", "V"],
        requested_schedules: ["II", "III", "IV", "V"],
        has_prior_violations: false,
        telemedicine_practice: true,  // REVIEW - requires attestation
        has_ryan_haight_attestation: false,  // REVIEW - missing
        multi_state: false,
        documented_jurisdictions: ["OH"],
        has_npi: true,
      }
    },
    {
      id: "approved",
      name: "APPROVED - All Requirements Met",
      description: "Valid DEA, state license, all requirements satisfied",
      decision_type: "csf_practitioner",
      engine_family: "csf",
      evidence: {
        dea_registration: true,
        dea_expiry_days: 365,
        state_license_status: "Active",
        state_license_expiry_days: 400,
        authorized_schedules: ["II", "III", "IV", "V"],
        requested_schedules: ["III", "IV", "V"],
        has_prior_violations: false,
        telemedicine_practice: false,
        has_ryan_haight_attestation: false,
        multi_state: false,
        documented_jurisdictions: ["OH"],
        has_npi: true,
      }
    },
  ];
}
