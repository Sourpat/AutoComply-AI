import { OhioTdddDecision, OhioTdddFormData } from "../domain/licenseOhioTddd";
import { API_BASE } from "../lib/api";

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

  const data = await resp.json();
  const decision = (data?.decision ?? data) as OhioTdddDecision;

  return {
    ...decision,
    regulatory_references: decision.regulatory_references ?? [],
    missingFields: (decision as any).missingFields ?? decision.missing_fields ?? [],
  } as OhioTdddDecision;
}
