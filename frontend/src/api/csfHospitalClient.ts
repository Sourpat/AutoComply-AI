// src/api/csfHospitalClient.ts
import {
  HospitalCsfDecision,
  HospitalCsfFormData,
} from "../domain/csfHospital";

// Shared API base helper for all CSF clients (hospital, facility, etc.)
// This is the single source of truth for where the backend lives.
const getApiBase = (): string => {
  const metaEnv = (import.meta as any)?.env ?? {};
  const viteBaseRaw =
    (metaEnv.VITE_API_BASE as string | undefined) ??
    (metaEnv.VITE_API_BASE_URL as string | undefined);

  // 1) Prefer explicit Vite env if set (including empty string)
  if (viteBaseRaw !== undefined) {
    return viteBaseRaw;
  }

  // 2) Local dev: frontend on 5173, backend on 8000
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  ) {
    return "http://127.0.0.1:8000";
  }

  // 3) Fallback: same origin (for deployed envs where API is served by UI host)
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.host}`;
  }

  // 4) Last resort – empty string; callers can show a config error
  return "";
};

// Exported so other CSF clients (facility, copilot, etc.) can reuse it
export const API_BASE = getApiBase();

export async function evaluateHospitalCsf(
  form: HospitalCsfFormData
): Promise<HospitalCsfDecision> {
  const resp = await fetch(`${API_BASE}/csf/hospital/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      facility_name: form.facilityName,
      facility_type: form.facilityType,
      account_number: form.accountNumber ?? null,
      pharmacy_license_number: form.pharmacyLicenseNumber,
      dea_number: form.deaNumber,
      pharmacist_in_charge_name: form.pharmacistInChargeName,
      pharmacist_contact_phone: form.pharmacistContactPhone ?? null,
      ship_to_state: form.shipToState,
      attestation_accepted: form.attestationAccepted,
      internal_notes: form.internalNotes ?? null,

      // NEW
      controlled_substances: form.controlledSubstances ?? [],
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `Hospital CSF evaluation failed with status ${resp.status}`
    );
  }

  return resp.json();
}
