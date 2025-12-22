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

// Developer visibility: log the resolved API base on page load
if (typeof window !== "undefined") {
  console.info("[AutoComply] API_BASE =", API_BASE);
}

export async function evaluateHospitalCsf(
  form: HospitalCsfFormData | Record<string, any>
): Promise<HospitalCsfDecision> {
  const pick = (primary: any, fallback: any, defaultValue: any = "") => {
    if (primary !== undefined && primary !== null) return primary;
    if (fallback !== undefined && fallback !== null) return fallback;
    return defaultValue;
  };

  const facilityName = pick((form as any).facilityName, (form as any).facility_name);
  const facilityType = pick((form as any).facilityType, (form as any).facility_type, "hospital");
  const accountNumber = pick((form as any).accountNumber, (form as any).account_number, null);
  const pharmacyLicenseNumber = pick(
    (form as any).pharmacyLicenseNumber,
    (form as any).pharmacy_license_number,
  );
  const deaNumber = pick((form as any).deaNumber, (form as any).dea_number);
  const pharmacistInChargeName = pick(
    (form as any).pharmacistInChargeName,
    (form as any).pharmacist_in_charge_name,
  );
  const pharmacistContactPhone = pick(
    (form as any).pharmacistContactPhone,
    (form as any).pharmacist_contact_phone,
    null,
  );
  const shipToState = pick((form as any).shipToState, (form as any).ship_to_state);
  const attestationAccepted = pick(
    (form as any).attestationAccepted,
    (form as any).attestation_accepted,
    false,
  );
  const internalNotes = pick((form as any).internalNotes, (form as any).internal_notes, null);
  const controlledSubstances = pick(
    (form as any).controlledSubstances,
    (form as any).controlled_substances,
    [],
  );

  const resp = await fetch(`${API_BASE}/csf/hospital/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      facility_name: facilityName,
      facility_type: facilityType,
      account_number: accountNumber,
      pharmacy_license_number: pharmacyLicenseNumber,
      dea_number: deaNumber,
      pharmacist_in_charge_name: pharmacistInChargeName,
      pharmacist_contact_phone: pharmacistContactPhone,
      ship_to_state: shipToState,
      attestation_accepted: attestationAccepted,
      internal_notes: internalNotes,

      // NEW
      controlled_substances: controlledSubstances ?? [],
    }),
  });

  if (!resp.ok) {
    let detail: string | undefined;
    try {
      const errorBody = await resp.json();
      const detailItems: string[] =
        (errorBody?.detail ?? [])
          .map((d: any) => d?.msg || d?.message)
          .filter(Boolean) || [];
      if (detailItems.length > 0) {
        detail = detailItems.join("; ");
      }
    } catch (err) {
      // ignore JSON parse errors
    }

    const message = detail
      ? `Hospital CSF evaluation failed: ${detail}`
      : `Hospital CSF evaluation failed with status ${resp.status}`;

    const error = new Error(message);
    (error as any).status = resp.status;
    (error as any).detail = detail;
    throw error;
  }

  const data = await resp.json();
  const decision = (data?.decision ?? data) as HospitalCsfDecision;

  return {
    ...decision,
    regulatory_references: decision.regulatory_references ?? [],
    missing_fields: decision.missing_fields ?? [],
  };
}
