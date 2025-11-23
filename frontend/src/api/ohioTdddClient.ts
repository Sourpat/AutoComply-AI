import { OhioTdddFormData, OhioTdddDecision } from "../domain/ohioTddd";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "";

export async function evaluateOhioTddd(
  form: OhioTdddFormData
): Promise<OhioTdddDecision> {
  const resp = await fetch(`${API_BASE}/ohio-tddd/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_name: form.businessName,
      license_type: form.licenseType,
      license_number: form.licenseNumber,
      ship_to_state: form.shipToState,
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `Ohio TDDD evaluation failed with status ${resp.status}`
    );
  }

  return resp.json();
}
