/**
 * CSF Actions Hook
 * 
 * Step 2.8: Submission Intake Integration
 * WITH BACKEND API INTEGRATION (Auto-fallback to localStorage)
 * 
 * Handles CSF form evaluation and submission with automatic case creation.
 * When a form is submitted, creates a submission record and intakes it into
 * the work queue system with RAG evidence attachment.
 * 
 * BACKEND INTEGRATION:
 * - Creates submission via backend /submissions when available
 * - Falls back to localStorage when backend unavailable
 * - Passes to intakeSubmissionToCase which handles backend/localStorage routing
 * 
 * ============================================================================
 * MANUAL VERIFICATION CHECKLIST:
 * ============================================================================
 * 
 * SETUP:
 * [ ] Backend: .venv\Scripts\python -m uvicorn src.api.main:app --port 8001
 * [ ] Frontend: npm run dev
 * [ ] Health: curl http://localhost:8001/workflow/health
 * 
 * TEST 1: Backend Mode
 * [ ] Submit CSF Practitioner form
 * [ ] Success banner appears
 * [ ] Console logs: "Using backend API to create case"
 * [ ] Network: POST /submissions → 200
 * [ ] Network: POST /workflow/cases → 200
 * [ ] Network: POST /workflow/cases/{id}/evidence/attach → 200
 * [ ] Click "Open Case" → navigates to Console with case selected
 * [ ] Case status is "NEW" or "NEEDS_REVIEW" with SLA due date
 * [ ] Timeline shows backend-created audit events
 * [ ] Evidence tab has auto-attached RAG evidence
 * [ ] Submission tab shows original form data
 * [ ] Refresh page → all data persists (backend storage)
 * 
 * TEST 2: LocalStorage Fallback
 * [ ] Stop backend server
 * [ ] Submit CSF Practitioner form
 * [ ] Success banner appears (no errors)
 * [ ] Console logs: "Backend unavailable, using localStorage"
 * [ ] Click "Open Case" → navigates to Console
 * [ ] Case visible in work queue
 * [ ] Timeline shows 3 manual audit events
 * [ ] Evidence tab has RAG evidence
 * [ ] Refresh page → data persists in localStorage
 * 
 * TEST 3: Assignment & Status Updates
 * [ ] Backend running: Submit form → assign reviewer → refresh → persists
 * [ ] Backend running: Change status → refresh → persists
 * [ ] Backend stopped: Assign reviewer → refresh → persists in localStorage
 * [ ] Timeline shows audit events for assignments/status changes
 * 
 * ============================================================================
 */

import { useState } from "react";
import { apiFetch } from "../lib/api";
import { createSubmission as createSubmissionViaSelector } from "../submissions/submissionStoreSelector";
import { intakeSubmissionToCase } from "../workflow/submissionIntakeService";
import type { CreateSubmissionInput } from "../submissions/submissionTypes";

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
  const [caseId, setCaseId] = useState<string | null>(null);

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
      // Backend expects flat JSON payload with trace_id at top level
      const submitPayload = {
        ...payload,
        trace_id: lastEvaluatedTraceId || undefined,
      };
      
      // 1. Try backend submission first (for connected mode)
      let backendSubmissionId: string | undefined;
      let backendTraceId: string | undefined;
      let backendDecision: any = null;
      
      try {
        const data = await apiFetch<SubmitResponse>(`/csf/${csfType}/submit`, {
          method: "POST",
          body: JSON.stringify(submitPayload),
        });
        backendSubmissionId = data.submission_id;
        backendTraceId = data.trace_id || undefined;
        backendDecision = {
          status: data.decision_status || data.status,
          riskLevel: decision?.decision?.risk_level,
        };
      } catch (backendError) {
        // Backend unavailable - continue with local-only mode
        console.warn('[useCsfActions] Backend unavailable, using local-only submission');
      }
      
      // 2. Create SubmissionRecord (via backend if available, localStorage fallback)
      const decisionTypeMap: Record<CsfType, string> = {
        practitioner: 'csf_practitioner',
        hospital: 'csf_facility',
        facility: 'csf_facility',
        ems: 'csf_facility',
        researcher: 'csf_researcher',
      };
      
      const submissionInput: CreateSubmissionInput = {
        decisionType: decisionTypeMap[csfType] || 'csf_practitioner',
        formData: payload,
        rawPayload: submitPayload,
        evaluatorOutput: backendDecision || decision ? {
          status: backendDecision?.status || decision?.decision?.status || decision?.status,
          riskLevel: backendDecision?.riskLevel || decision?.decision?.risk_level,
          traceId: backendTraceId || lastEvaluatedTraceId || undefined,
          explanation: decision?.decision?.reason || decision?.reason,
        } : undefined,
      };
      
      // Use selector which tries backend first, falls back to localStorage
      const submission = await createSubmissionViaSelector(submissionInput);
      setSubmissionId(submission.id);
      setTraceId(backendTraceId || lastEvaluatedTraceId || null);
      
      // 3. Create work queue case with RAG evidence (also tries backend first)
      const { caseId: newCaseId } = await intakeSubmissionToCase(submission.id);
      setCaseId(newCaseId);
      
      console.log('[useCsfActions] Submission complete:', {
        submissionId: submission.id,
        caseId: newCaseId,
        backendSubmissionId,
      });
      
      return {
        submission_id: backendSubmissionId || submission.id,
        trace_id: backendTraceId || lastEvaluatedTraceId || undefined,
        status: backendDecision?.status || 'submitted',
        local_submission_id: submission.id,
        case_id: newCaseId,
      };
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
    setCaseId(null);
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
    caseId,
  };
}
