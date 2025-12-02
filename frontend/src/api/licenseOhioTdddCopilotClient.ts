import {
  OhioTdddFormData,
  OhioTdddFormCopilotResponse,
} from "../domain/licenseOhioTddd";
import { API_BASE } from "./csfHospitalClient";

export async function callOhioTdddFormCopilot(
  form: OhioTdddFormData
): Promise<OhioTdddFormCopilotResponse> {
  const resp = await fetch(`${API_BASE}/license/ohio-tddd/form-copilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(`Ohio TDDD Form Copilot failed with status ${message}`);
  }

  return (await resp.json()) as OhioTdddFormCopilotResponse;
}
