import { API_BASE } from "../lib/api";
import type { PolicyOverrideAction, PolicyOverrideDetail } from "../types/decision";

export type PolicyOverrideRequest = {
  action: PolicyOverrideAction;
  rationale: string;
  reviewer: string;
};

export type PolicyOverrideResponse = {
  override: PolicyOverrideDetail | Record<string, never>;
  before_status?: string | null;
  after_status?: string | null;
};

async function readErrorMessage(response: Response) {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
  } catch {
    // ignore
  }
  return `Request failed (${response.status})`;
}

export async function applyPolicyOverride(
  submissionId: string,
  payload: PolicyOverrideRequest
): Promise<{ ok: boolean; data?: PolicyOverrideResponse; message?: string }> {
  try {
    const response = await fetch(
      `${API_BASE}/api/agentic/cases/${submissionId}/policy-override`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response) };
    }
    return { ok: true, data: (await response.json()) as PolicyOverrideResponse };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

export async function getPolicyOverride(
  submissionId: string
): Promise<{ ok: boolean; data?: PolicyOverrideResponse; message?: string }> {
  try {
    const response = await fetch(
      `${API_BASE}/api/agentic/cases/${submissionId}/policy-override`
    );
    if (!response.ok) {
      return { ok: false, message: await readErrorMessage(response) };
    }
    return { ok: true, data: (await response.json()) as PolicyOverrideResponse };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Network error" };
  }
}

export async function listPolicyOverrides(limit: number = 200): Promise<PolicyOverrideDetail[]> {
  const response = await fetch(
    `${API_BASE}/api/agentic/policy-overrides/recent?limit=${limit}`
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as PolicyOverrideDetail[];
}
