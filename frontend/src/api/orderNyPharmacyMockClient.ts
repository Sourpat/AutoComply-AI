import { API_BASE } from "../lib/api";
import { NyPharmacyFormData } from "../domain/licenseNyPharmacy";
import { NyPharmacyOrderApprovalResult } from "../domain/orderMockApproval";
import type { DecisionOutcome, DecisionStatus } from "../types/decision";

export interface NyPharmacyOrderMockRun {
  request: { ny_pharmacy: any };
  response: NyPharmacyOrderApprovalResult;
}

const normalizeStatus = (status: string | undefined | null): DecisionStatus => {
  if (status === "approved") return "ok_to_ship";
  if (status === "manual_review") return "needs_review";
  if (status === "blocked") return "blocked";
  if (status === "ok_to_ship") return "ok_to_ship";
  if (status === "needs_review") return "needs_review";
  return "needs_review";
};

const normalizeDecision = (raw: any): DecisionOutcome => {
  const regulatory_references = raw?.regulatory_references ?? [];

  return {
    status: normalizeStatus(raw?.status),
    reason:
      raw?.reason ??
      (Array.isArray(raw?.notes) ? raw.notes.join(" ") : "Decision reason unavailable"),
    regulatory_references,
    debug_info: raw?.debug_info ?? raw?.developer_trace ?? null,
    trace_id: raw?.trace_id ?? null,
    risk_level: raw?.risk_level ?? null,
    risk_score: raw?.risk_score ?? null,
  };
};

export async function runNyPharmacyOrderMock(
  form: NyPharmacyFormData
): Promise<NyPharmacyOrderMockRun> {
  const requestBody = {
    ny_pharmacy: {
      pharmacy_name: form.pharmacyName,
      account_number: form.accountNumber,
      ship_to_state: form.shipToState,
      dea_number: form.deaNumber ?? null,
      ny_state_license_number: form.nyStateLicenseNumber,
      attestation_accepted: form.attestationAccepted,
      internal_notes: form.internalNotes ?? "",
    },
  };

  const resp = await fetch(`${API_BASE}/orders/mock/ny-pharmacy-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(
      `NY Pharmacy mock order approval failed with status ${resp.status}: ${message}`
    );
  }

  const json = await resp.json();
  const decision = normalizeDecision(json?.decision ?? json);

  const response: NyPharmacyOrderApprovalResult = {
    decision,
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
