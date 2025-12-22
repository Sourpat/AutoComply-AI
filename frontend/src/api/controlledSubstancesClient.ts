// src/api/controlledSubstancesClient.ts
import { API_BASE } from "../lib/api";

export interface ControlledSubstance {
  id: string;
  name: string;
  strength?: string;
  unit?: string;
  schedule?: string;
  dea_code?: string;
  // Backwards-compatible fields that may be returned by existing endpoints
  ndc?: string | null;
  dosage_form?: string | null;
  dea_schedule?: string | null;
}

export interface ControlledSubstanceHistoryItem extends ControlledSubstance {
  last_ordered_at?: string;
  account_number?: string;
}

export async function searchControlledSubstances(
  query: string
): Promise<ControlledSubstance[]> {
  if (!query.trim()) return [];

  const resp = await fetch(
    `${API_BASE}/controlled-substances/search?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
    }
  );

  if (!resp.ok) {
    throw new Error(
      `/controlled-substances/search failed with status ${resp.status}`
    );
  }

  return resp.json();
}

export async function fetchControlledSubstancesHistory(
  accountNumber: string
): Promise<ControlledSubstanceHistoryItem[]> {
  if (!accountNumber.trim()) return [];

  const resp = await fetch(
    `${API_BASE}/controlled-substances/history?account_number=${encodeURIComponent(
      accountNumber
    )}`,
    {
      method: "GET",
    }
  );

  if (!resp.ok) {
    throw new Error(
      `/controlled-substances/history failed with status ${resp.status}`
    );
  }

  return resp.json();
}

// Legacy alias to preserve existing consumers
export const getControlledSubstancesHistory = fetchControlledSubstancesHistory;
