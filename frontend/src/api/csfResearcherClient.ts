// src/api/csfResearcherClient.ts
import {
  ResearcherCsfDecision,
  ResearcherCsfFormData,
} from "../domain/csfResearcher";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  "";

export async function evaluateResearcherCsf(
  form: ResearcherCsfFormData
): Promise<ResearcherCsfDecision> {
  const resp = await fetch(`${API_BASE}/csf/researcher/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      institution_name: form.institutionName,
      facility_type: form.facilityType,
      account_number: form.accountNumber ?? null,
      principal_investigator_name: form.principalInvestigatorName,
      researcher_title: form.researcherTitle ?? null,
      state_license_number: form.stateLicenseNumber ?? null,
      dea_number: form.deaNumber ?? null,
      protocol_or_study_id: form.protocolOrStudyId,
      ship_to_state: form.shipToState,
      attestation_accepted: form.attestationAccepted,
      internal_notes: form.internalNotes ?? null,

      // NEW
      controlled_substances: form.controlledSubstances ?? [],
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `Researcher CSF evaluation failed with status ${resp.status}`
    );
  }

  return resp.json();
}
