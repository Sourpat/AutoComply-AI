import { useState } from "react";
import { apiFetch } from "../lib/api";

type CsfType = "practitioner" | "hospital" | "facility" | "ems" | "researcher";

interface EvaluateResponse {
  decision?: {
    status: string;
    reason: string;
    risk_level?: string;
  };
  status?: string;
  reason?: string;
  trace_id?: string;
}

interface SubmitResponse {
  submission_id: string;
  trace_id?: string;
  status: string;
  decision_status?: string;
  reason?: string;
}

export function useCsfActions(csfType: CsfType) {
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decision, setDecision] = useState<EvaluateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [traceId, setTraceId] = useState<string | null>(null);
  const [lastEvaluatedTraceId, setLastEvaluatedTraceId] = useState<string | null>(null);

  const evaluate = async (payload: Record<string, unknown>) => {
    setIsEvaluating(true);
    setError(null);
    setDecision(null);

    try {
      const data = await apiFetch<EvaluateResponse>(`/csf/${csfType}/evaluate`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setDecision(data);
      // Store trace_id from evaluate response
      if (data.trace_id) {
        setLastEvaluatedTraceId(data.trace_id);
      }
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to evaluate CSF";
      console.error(`[useCsfActions] Evaluate error for ${csfType}:`, err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsEvaluating(false);
    }
  };

  const submit = async (payload: Record<string, unknown>) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Include trace_id from last evaluate if available
      const submitPayload = {
        form: payload,
        trace_id: lastEvaluatedTraceId,
      };
      
      const data = await apiFetch<SubmitResponse>(`/csf/${csfType}/submit`, {
        method: "POST",
        body: JSON.stringify(submitPayload),
      });
      setSubmissionId(data.submission_id);
      setTraceId(data.trace_id || null);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to submit CSF";
      console.error(`[useCsfActions] Submit error for ${csfType}:`, err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setDecision(null);
    setError(null);
    setSubmissionId(null);
    setTraceId(null);
    setLastEvaluatedTraceId(null);
  };

  return {
    evaluate,
    submit,
    reset,
    isEvaluating,
    isSubmitting,
    decision,
    error,
    submissionId,
    traceId,
    lastEvaluatedTraceId,
  };
}
