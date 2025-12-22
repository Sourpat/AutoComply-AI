import { OhioHospitalOrderApprovalResult } from "../domain/orderMockApproval";
import type { DecisionOutcome, DecisionStatus } from "../types/decision";
import { API_BASE } from "../lib/api";

export type OrderScenarioKind =
  | "happy_path"
  | "missing_tddd"
  | "non_ohio_no_tddd";

export interface OhioHospitalOrderScenarioRequest {
  hospital_csf: any;
  ohio_tddd?: any;
}

export interface OhioHospitalOrderScenarioRun {
  request: OhioHospitalOrderScenarioRequest;
  response: OhioHospitalOrderApprovalResult;
}

const normalizeStatus = (status: string | undefined | null): DecisionStatus => {
  if (status === "approved") return "ok_to_ship";
  if (status === "manual_review") return "needs_review";
  if (status === "blocked") return "blocked";
  if (status === "ok_to_ship") return "ok_to_ship";
  if (status === "needs_review") return "needs_review";
  return "needs_review";
};

const normalizeDecision = (
  raw: any,
  fallbackReason?: string
): DecisionOutcome => {
  const regulatory_references = raw?.regulatory_references ?? [];

  return {
    status: normalizeStatus(raw?.status),
    reason:
      raw?.reason ??
      fallbackReason ??
      (Array.isArray(raw?.notes) ? raw.notes.join(" ") : ""),
    regulatory_references,
    debug_info: raw?.debug_info ?? raw?.developer_trace ?? null,
    trace_id: raw?.trace_id ?? null,
    risk_level: raw?.risk_level ?? null,
    risk_score: raw?.risk_score ?? null,
  };
};

export async function runOhioHospitalOrderScenario(
  scenario: OrderScenarioKind
): Promise<OhioHospitalOrderScenarioRun> {
  const isNonOhio = scenario === "non_ohio_no_tddd";

  const baseCsfPayload = {
    facility_name: isNonOhio
      ? "Pennsylvania General Hospital"
      : "Ohio General Hospital",
    facility_type: "hospital",
    account_number: isNonOhio ? "800987654" : "800123456",
    pharmacy_license_number: isNonOhio ? "PA-PRX-98765" : "OH-PRX-12345",
    ship_to_state: isNonOhio ? "PA" : "OH",
    dea_number: isNonOhio ? "CD7654321" : "AB1234567",
    pharmacist_in_charge_name: isNonOhio ? "Dr. John Smith" : "Dr. Jane Doe",
    pharmacist_contact_phone: isNonOhio ? "555-987-6543" : "555-123-4567",
    attestation_accepted: true,
    internal_notes:
      scenario === "happy_path"
        ? "Mock order test – Ohio hospital Schedule II, expected ok_to_ship."
        : scenario === "missing_tddd"
        ? "Negative mock order test – missing TDDD number."
        : "Mock order test – non-Ohio hospital Schedule II, no Ohio TDDD payload.",
    controlled_substances: [
      {
        id: "cs-oxy-10mg-tab",
        name: "Oxycodone 10mg",
        ndc: "12345-6789-02",
        strength: "10 mg",
        dosage_form: "tablet",
        dea_schedule: "II",
        schedule: "II",
        quantity: 100,
      },
    ],
  };

  const ohTddd =
    scenario === "happy_path"
      ? {
          tddd_number: "01234567",
          facility_name: "Ohio General Hospital",
          account_number: "800123456",
          ship_to_state: "OH",
          license_type: "ohio_tddd",
          attestation_accepted: true,
          internal_notes:
            "Valid Ohio TDDD license for mock order happy path scenario.",
        }
      : scenario === "missing_tddd"
      ? {
          tddd_number: "",
          facility_name: "Ohio General Hospital",
          account_number: "800123456",
          ship_to_state: "OH",
          license_type: "ohio_tddd",
          attestation_accepted: true,
          internal_notes:
            "Missing TDDD number for negative mock order scenario.",
        }
      : null; // non_ohio_no_tddd → we don't send Ohio TDDD payload at all

  const requestBody: OhioHospitalOrderScenarioRequest = {
    hospital_csf: baseCsfPayload,
    // For the non_ohio_no_tddd scenario, we omit Ohio TDDD entirely.
    ...(ohTddd !== null ? { ohio_tddd: ohTddd } : {}),
  };

  const resp = await fetch(`${API_BASE}/orders/mock/ohio-hospital-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    let detailedError = `Ohio Hospital mock order approval failed with status ${resp.status}`;
    try {
      const errorJson = await resp.json();
      if (errorJson?.detail) {
        if (Array.isArray(errorJson.detail)) {
          // Pydantic validation errors
          const fieldErrors = errorJson.detail
            .map((err: any) => `${err.loc?.join('.') || 'field'}: ${err.msg}`)
            .join('; ');
          detailedError = `Validation failed: ${fieldErrors}`;
        } else if (typeof errorJson.detail === 'string') {
          detailedError = errorJson.detail;
        }
      }
    } catch {
      // If JSON parsing fails, use text
      const text = await resp.text();
      if (text) detailedError += `: ${text}`;
    }
    throw new Error(detailedError);
  }

  const json = await resp.json();

  const decision = normalizeDecision(json?.decision ?? json, json?.final_decision);

  const response: OhioHospitalOrderApprovalResult = {
    decision,
    csf_decision: json?.csf_decision
      ? normalizeDecision(json.csf_decision)
      : json?.csf_status
      ? normalizeDecision(
          {
            status: json.csf_status,
            reason: json.csf_reason,
            regulatory_references: json.csf_regulatory_references,
            missing_fields: json.csf_missing_fields,
            debug_info: json.developer_trace,
          },
          json.csf_reason
        )
      : undefined,
    license_decision: json?.license_decision
      ? normalizeDecision(json.license_decision)
      : json?.tddd_status
      ? normalizeDecision(
          {
            status: json.tddd_status,
            reason: json.tddd_reason,
            regulatory_references: json.tddd_regulatory_references,
            missing_fields: json.tddd_missing_fields,
            debug_info: json.developer_trace,
          },
          json.tddd_reason
        )
      : undefined,
    csf_engine: json?.csf_engine ?? null,
    license_engine: json?.license_engine ?? null,
    scenario_id: json?.scenario_id ?? null,
    developer_trace: json?.developer_trace ?? null,
    notes: json?.notes ?? [],
  };

  return {
    request: requestBody,
    response,
  };
}
