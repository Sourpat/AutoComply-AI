import { OhioHospitalOrderApprovalResult } from "../domain/orderMockApproval";
import { API_BASE } from "./csfHospitalClient";

export type OrderScenarioKind = "happy_path" | "missing_tddd";

export async function runOhioHospitalOrderScenario(
  scenario: OrderScenarioKind
): Promise<OhioHospitalOrderApprovalResult> {
  const baseCsfPayload = {
    hospital_name: "Ohio General Hospital",
    facility_type: "hospital",
    account_number: "800123456",
    ship_to_state: "OH",
    dea_number: "AB1234567",
    pharmacist_in_charge_name: "Dr. Jane Doe",
    pharmacist_contact_phone: "555-123-4567",
    attestation_accepted: true,
    internal_notes:
      scenario === "happy_path"
        ? "Mock order test – Ohio hospital Schedule II, expected ok_to_ship."
        : "Negative mock order test – missing TDDD number.",
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
      : {
          tddd_number: "",
          facility_name: "Ohio General Hospital",
          account_number: "800123456",
          ship_to_state: "OH",
          license_type: "ohio_tddd",
          attestation_accepted: true,
          internal_notes:
            "Missing TDDD number for negative mock order scenario.",
        };

  const resp = await fetch(`${API_BASE}/orders/mock/ohio-hospital-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hospital_csf: baseCsfPayload,
      ohio_tddd: ohTddd,
    }),
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(
      `Ohio Hospital mock order approval failed with status ${resp.status}: ${message}`
    );
  }

  return (await resp.json()) as OhioHospitalOrderApprovalResult;
}
