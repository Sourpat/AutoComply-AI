import { OhioTdddDecision, OhioTdddFormData } from "../domain/ohioTddd";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

export async function evaluateOhioTddd(
  form: OhioTdddFormData
): Promise<OhioTdddDecision> {
  const resp = await fetch(`${API_BASE}/ohio-tddd/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer_response: form.customerResponse,
      practitioner_name: form.practitionerName,
      state_board_license_number: form.stateBoardLicenseNumber,
      tddd_license_number: form.tdddLicenseNumber ?? null,
      dea_number: form.deaNumber ?? null,
      tddd_license_category: form.tdddLicenseCategory ?? null,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Ohio TDDD evaluation failed with status ${resp.status}`);
  }

  return resp.json();
}
