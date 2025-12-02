import { OhioHospitalOrderApprovalResult } from "../domain/orderMockApproval";
import { API_BASE } from "./csfHospitalClient";

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

export async function runOhioHospitalOrderScenario(
  scenario: OrderScenarioKind
): Promise<OhioHospitalOrderScenarioRun> {
  const isNonOhio = scenario === "non_ohio_no_tddd";

  const baseCsfPayload = {
    hospital_name: isNonOhio
      ? "Pennsylvania General Hospital"
      : "Ohio General Hospital",
    facility_type: "hospital",
    account_number: isNonOhio ? "800987654" : "800123456",
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
        drug_name: "Oxycodone 10mg",
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
    const message = await resp.text();
    throw new Error(
      `Ohio Hospital mock order approval failed with status ${resp.status}: ${message}`
    );
  }

  const json = (await resp.json()) as OhioHospitalOrderApprovalResult;

  return {
    request: requestBody,
    response: json,
  };
}
