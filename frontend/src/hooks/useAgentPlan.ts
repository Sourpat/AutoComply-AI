import { useCallback, useEffect, useRef, useState } from "react";

import type { AgentPlan } from "../contracts/agentic";
import { API_BASE } from "../lib/api";

const planCache = new Map<string, AgentPlan>();

export function useAgentPlan(caseId: string) {
  const [plan, setPlan] = useState<AgentPlan | null>(() => planCache.get(caseId) ?? null);
  const [loading, setLoading] = useState(!planCache.has(caseId));
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!caseId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/agentic/cases/${caseId}/plan`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Failed to load plan (${response.status})`);
      }
      const data = (await response.json()) as AgentPlan;
      planCache.set(caseId, data);
      setPlan(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  const executeAction = useCallback(
    async (actionId: string, input?: Record<string, unknown>) => {
      if (!caseId) return null;
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${API_BASE}/api/agentic/cases/${caseId}/actions/${actionId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ input: input ?? null }),
          }
        );
        if (!response.ok) {
          throw new Error(`Action failed (${response.status})`);
        }
        const data = (await response.json()) as AgentPlan;
        planCache.set(caseId, data);
        setPlan(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to run action");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [caseId]
  );

  const submitInput = useCallback(
    async (questionId: string, input: Record<string, unknown>) => {
      if (!caseId) return null;
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_BASE}/api/agentic/cases/${caseId}/inputs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ questionId, input }),
        });
        if (!response.ok) {
          throw new Error(`Input submit failed (${response.status})`);
        }
        const data = (await response.json()) as AgentPlan;
        planCache.set(caseId, data);
        setPlan(data);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit input");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [caseId]
  );

  useEffect(() => {
    fetchPlan();
    return () => abortRef.current?.abort();
  }, [fetchPlan]);

  return {
    plan,
    loading,
    error,
    refresh: fetchPlan,
    executeAction,
    submitInput,
  };
}
