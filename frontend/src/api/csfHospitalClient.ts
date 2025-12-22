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

  // 1) Prefer explicit Vite env if set to a non-empty string
  if (viteBaseRaw !== undefined && viteBaseRaw.trim().length > 0) {
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
  const facilityType = pick((form as any).facilityType, (form as any).facility_type, "Hospital");
  const accountNumber = pick((form as any).accountNumber, (form as any).account_number, "");
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
    undefined,
  );
  const shipToState = pick((form as any).shipToState, (form as any).ship_to_state);
  const attestationAccepted = pick(
    (form as any).attestationAccepted,
    (form as any).attestation_accepted,
    false,
  );
  const internalNotes = pick((form as any).internalNotes, (form as any).internal_notes, undefined);
  const controlledSubstances = pick(
    (form as any).controlledSubstances,
    (form as any).controlled_substances,
    [],
  );

  const controlled = (controlledSubstances ?? []).map((x: any) => ({
    id: x?.id,
    name: x?.name,
    ndc: x?.ndc,
    strength: x?.strength,
    dosage_form: x?.dosage_form ?? x?.dosageForm ?? null,
    dea_schedule: x?.dea_schedule ?? x?.deaSchedule ?? null,
  }));

  const payload: Record<string, any> = {
    facility_name: facilityName ?? "",
    facility_type: (facilityType ?? "hospital").toString().toLowerCase(),
    account_number: accountNumber?.toString() ?? "",
    pharmacy_license_number: pharmacyLicenseNumber ?? "",
    dea_number: deaNumber ?? "",
    pharmacist_in_charge_name: pharmacistInChargeName ?? "",
    ship_to_state: shipToState ?? "",
    attestation_accepted: attestationAccepted,
    controlled_substances: controlled,
  };

  const trimmedInternalNotes = typeof internalNotes === "string" ? internalNotes.trim() : internalNotes;
  if (trimmedInternalNotes) {
    payload.internal_notes = trimmedInternalNotes;
  }

  const trimmedPharmacistPhone =
    typeof pharmacistContactPhone === "string" ? pharmacistContactPhone.trim() : pharmacistContactPhone;
  if (trimmedPharmacistPhone) {
    payload.pharmacist_contact_phone = trimmedPharmacistPhone;
  }

  const resp = await fetch(`${API_BASE}/csf/hospital/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    console.error("Hospital CSF evaluate payload", payload);

    let errorBody: any = null;
    try {
      errorBody = await resp.json();
    } catch (err) {
      // ignore JSON parse errors
    }

    const detail = errorBody?.detail
      ? JSON.stringify(errorBody.detail)
      : JSON.stringify(errorBody ?? {});

    const error = new Error(`Hospital CSF evaluation failed (${resp.status}). ${detail}`);
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
