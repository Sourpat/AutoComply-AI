// src/api/controlledSubstancesClient.ts
import { ControlledSubstanceItem } from "../domain/controlledSubstances";

const API_BASE = (import.meta as any).env?.VITE_API_BASE || "";

export async function searchControlledSubstances(
  query: string
): Promise<ControlledSubstanceItem[]> {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }

  const resp = await fetch(
    `${API_BASE}/controlled-substances/search?${params.toString()}`
  );

  if (!resp.ok) {
    throw new Error(
      `Controlled substances search failed with status ${resp.status}`
    );
  }

  return resp.json();
}

export async function getControlledSubstancesHistory(
  accountNumber: string
): Promise<ControlledSubstanceItem[]> {
  if (!accountNumber) {
    return [];
  }

  const params = new URLSearchParams();
  params.set("account_number", accountNumber);

  const resp = await fetch(
    `${API_BASE}/controlled-substances/history?${params.toString()}`
  );

  if (!resp.ok) {
    throw new Error(
      `Controlled substances history failed with status ${resp.status}`
    );
  }

  return resp.json();
}
