import { OhioTdddDecision, OhioTdddFormData } from "../domain/licenseOhioTddd";
import { API_BASE } from "./csfHospitalClient";

export async function evaluateOhioTdddLicense(
  form: OhioTdddFormData
): Promise<OhioTdddDecision> {
  const resp = await fetch(`${API_BASE}/license/ohio-tddd/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(
      `Ohio TDDD license evaluation failed with status ${resp.status}: ${message}`
    );
  }

  return (await resp.json()) as OhioTdddDecision;
}
