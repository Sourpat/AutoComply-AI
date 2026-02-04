import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ragExplain, type DecisionExplainResponse } from "../../api/ragClient";
import { getWorkQueue, getConsoleSubmission, type WorkQueueSubmission } from "../../api/consoleClient";
import { get_mock_scenarios } from "../../api/mockScenarios";
import { useRagDebug } from "../../devsupport/RagDebugContext";
import { demoStore } from "../../lib/demoStore";
import type { Submission } from "../../types/workQueue";
import { normalizeTrace, type NormalizedTrace } from "../../lib/traceNormalizer";
import { buildDecisionPacket } from "../../utils/buildDecisionPacket";
import { downloadJson, downloadHtml } from "../../utils/exportPacket";
import { generateDecisionPacketHtml } from "../../templates/decisionPacketTemplate";
import type { CompletenessScore } from "../../lib/completenessScorer";
import { API_BASE } from "../../lib/api";
import { generateCounterfactuals, type Counterfactual } from "../../lib/counterfactualGenerator";
import { generateRequestInfoMessage, type RequestInfoTemplate } from "../../lib/requestInfoGenerator";
import {
  completenessSchemas,
  type CompletenessField,
  type CompletenessSchema,
} from "../../submissions/submissionTypes";
import { useRole } from "../../context/RoleContext";
import {
  canViewEvidence,
  canViewRuleIds,
  canUseConnectedMode,
  canViewDebugPanels,
  canDownloadPackets,
  canViewFiredRules,
  canViewCounterfactuals,
  canExportHtml,
  canViewCompletenessDetails
} from "../../auth/permissions";
import { Timeline } from "../../components/Timeline";
import type { AuditEvent } from "../../types/audit";
import { EvidenceDrawer } from "../../components/EvidenceDrawer";
import type { EvidenceItem } from "../../types/evidence";

type RequestState = "idle" | "loading" | "empty" | "error" | "success";
type DecisionSource = "sandbox" | "connected";

interface EvidenceChip {
  docId?: string;
  docTitle: string;
  jurisdiction?: string;
  snippet?: string;
  section?: string;
  resultId?: string;
}

interface FiredRule {
  id: string;
  title: string;
  severity: string;
  jurisdiction: string;
  citation: string;
  rationale: string;
  snippet?: string;
  requirement: string;
  evidence?: EvidenceChip[];
}

interface EvaluatedRule {
  id: string;
  title: string;
  severity: string;
  jurisdiction: string;
  citation: string;
  rationale: string;
  requirement: string;
  status: string; // "passed" | "failed" | "info"
}

type LocalCompleteness = {
  scorePct: number;
  presentCount: number;
  totalCount: number;
  missing: {
    block: string[];
    review: string[];
    info: string[];
  };
  missingByCategory: Record<"block" | "review" | "info", CompletenessField[]>;
};

const getValueByPath = (source: Record<string, unknown> | null, path: string): unknown => {
  if (!source) return undefined;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
};

const getValueByPathSet = (
  source: Record<string, unknown> | null,
  path: string | string[]
): unknown => {
  if (!source) return undefined;
  const paths = Array.isArray(path) ? path : [path];
  for (const candidate of paths) {
    const value = getValueByPath(source, candidate);
    if (value !== undefined) return value;
  }
  return undefined;
};

const isValuePresent = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
};

const computeCompleteness = (
  payload: Record<string, unknown> | null,
  schema: CompletenessSchema
): LocalCompleteness => {
  const totalCount = schema.fields.length;
  const missingByCategory = {
    block: [] as CompletenessField[],
    review: [] as CompletenessField[],
    info: [] as CompletenessField[]
  };

  let presentCount = 0;

  for (const field of schema.fields) {
    const isPresent = isValuePresent(getValueByPathSet(payload, field.path));
    if (isPresent) {
      presentCount += 1;
    } else {
      missingByCategory[field.category].push(field);
    }
  }

  const scorePct = totalCount === 0 ? 0 : Math.round((presentCount / totalCount) * 100);
  return {
    presentCount,
    totalCount,
    scorePct,
    missingByCategory,
    missing: {
      block: missingByCategory.block.map((field) => field.label),
      review: missingByCategory.review.map((field) => field.label),
      info: missingByCategory.info.map((field) => field.label)
    }
  };
};

const getDecisionTraceFromPayload = (payload: Record<string, unknown> | null) => {
  if (!payload) return null;
  const decision = (payload as Record<string, unknown>).decision;
  if (decision && typeof decision === "object") {
    return decision as Record<string, unknown>;
  }
  return null;
};

const mapWorkQueueSubmission = (item: WorkQueueSubmission): Submission => {
  const payload = (item.payload ?? {}) as Record<string, unknown>;
  const decisionTrace = getDecisionTraceFromPayload(payload);
  const formPayload = (payload as Record<string, unknown>).form as Record<string, unknown> | undefined;

  return {
    id: item.submission_id,
    kind: "csf",
    displayName: item.title,
    submittedAt: item.created_at,
    payload: formPayload ?? payload,
    decisionTrace: decisionTrace ?? {
      status: item.decision_status,
      risk_level: item.risk_level,
      decision_summary: item.summary ?? "",
      fired_rules: [],
      missing_evidence: [],
      next_steps: [],
    },
    status: item.status as any,
    traceId: item.trace_id,
    csfType: item.csf_type,
    tenantId: item.tenant,
  };

const resolveSchemaKey = (candidate?: string | null): string => {
  if (!candidate) return "default";
  const normalized = candidate.toLowerCase();
  if (normalized in completenessSchemas) return normalized;
  if (normalized.includes("csf") && normalized.includes("practitioner")) return "csf_practitioner";
  if (normalized.includes("csf") && normalized.includes("facility")) return "csf_facility";
  if (normalized.includes("csf") && normalized.includes("hospital")) return "csf_hospital";
  if (normalized.includes("tddd")) return "ohio_tddd";
  return "default";
};

const extractPayload = (detail: Record<string, unknown> | null) => {
  if (!detail) return null;
  const candidates = [
    detail.payload,
    detail.submission_payload,
    detail.form_data,
    detail.data,
    (detail.submission as Record<string, unknown> | undefined)?.payload,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && Object.keys(candidate as Record<string, unknown>).length > 0) {
      return candidate as Record<string, unknown>;
    }
  }
  return null;
};
};

interface RegulatoryDecisionExplainPanelProps {
  selectedExplainRequest?: any;
  onConsumed?: () => void;
  explainPanelRef?: React.RefObject<HTMLDivElement>;
  caseId?: string; // For evidence packet tracking
}

export function RegulatoryDecisionExplainPanel({
  selectedExplainRequest,
  onConsumed,
  explainPanelRef,
  caseId = 'explainability-default', // Default case ID for standalone explainability
}: RegulatoryDecisionExplainPanelProps) {
  const ragDebugContext = useRagDebug();
  const aiDebugEnabled = ragDebugContext?.enabled || false;
  const { role, isSubmitter, isVerifier, isAdmin } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [decisionSource, setDecisionSource] = useState<DecisionSource>("sandbox");
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  
  // Connected mode state
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<string>("");
  const [loadedTrace, setLoadedTrace] = useState<Submission | null>(null);
  const [selectedSubmissionPayload, setSelectedSubmissionPayload] = useState<Record<string, unknown> | null>(null);
  const [selectedSchemaKey, setSelectedSchemaKey] = useState<string>("default");
  const [submissionMenuOpen, setSubmissionMenuOpen] = useState(false);
  
  const [state, setState] = useState<RequestState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DecisionExplainResponse | null>(null);
  const [normalizedTrace, setNormalizedTrace] = useState<NormalizedTrace | null>(null);
  const [readyBanner, setReadyBanner] = useState<string | null>(null);
  
  // Explainability quality state
  const [completenessScore, setCompletenessScore] = useState<LocalCompleteness | null>(null);
  const [counterfactuals, setCounterfactuals] = useState<Counterfactual[]>([]);

  // Evidence Drawer state
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

  const handleOpenEvidence = (evidence: EvidenceItem) => {
    setSelectedEvidence(evidence);
    setEvidenceDrawerOpen(true);
  };

  const handleCloseEvidence = () => {
    setEvidenceDrawerOpen(false);
    setSelectedEvidence(null);
  };
  const [requestInfo, setRequestInfo] = useState<RequestInfoTemplate | null>(null);
  
  // Timeline state for connected mode
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  // Load scenarios on mount
  useEffect(() => {
    const mockScenarios = get_mock_scenarios();
    const decisionTypeParam = searchParams.get("decisionType");
    
    // Filter scenarios by decisionType if provided
    const filteredScenarios = decisionTypeParam 
      ? mockScenarios.filter(s => s.decision_type === decisionTypeParam)
      : mockScenarios;
    
    setScenarios(filteredScenarios);
    if (filteredScenarios.length > 0) {
      setSelectedScenario(filteredScenarios[0].id);
    }
    
    if (decisionTypeParam && filteredScenarios.length > 0) {
      console.log(`[RAG Explorer] Filtered to ${filteredScenarios.length} scenarios for ${decisionTypeParam}`);
    }
  }, [searchParams]);

  // Load recent submissions when switching to connected mode
  useEffect(() => {
    if (decisionSource === "connected" && recentSubmissions.length === 0) {
      loadRecentSubmissions();
    }
  }, [decisionSource]);

  // Keep submissions list unfiltered in connected mode
  useEffect(() => {
    setFilteredSubmissions(recentSubmissions);
  }, [recentSubmissions]);

  // Handle deep linking - auto-load trace from URL params
  useEffect(() => {
    const mode = searchParams.get("mode");
    const submissionId = searchParams.get("submissionId");
    const caseId = searchParams.get("caseId"); // Step 2.4: Support caseId from CaseWorkspace
    const traceId = searchParams.get("traceId");
    const autoload = searchParams.get("autoload");
    const decisionType = searchParams.get("decisionType"); // Coverage deep-linking
    
    // If decisionType is provided, pre-filter scenarios and switch to sandbox mode
    if (decisionType && mode === "sandbox") {
      setDecisionSource("sandbox");
      // The scenario dropdown will automatically filter by decision_type
      console.log(`[RAG Explorer] Filtering scenarios for decisionType: ${decisionType}`);
    }
    
    if (mode === "connected") {
      setDecisionSource("connected");
      
      // Step 2.4: If caseId is provided, find the submission from work queue
      if (caseId) {
        const workQueue = demoStore.getWorkQueue();
        const queueItem = workQueue.find(item => item.id === caseId);
        if (queueItem?.submissionId) {
          setSelectedSubmission(queueItem.submissionId);
          if (autoload === "1") {
            // Auto-trigger explain - navigate to connected mode
            getConsoleSubmission(queueItem.submissionId)
              .then((submissionRecord) => {
                if (submissionRecord) {
                  window.location.href = `/console/rag?mode=connected&submissionId=${submissionRecord.submission_id}`;
                }
              })
              .catch(() => null);
          }
        }
      } else if (submissionId) {
        setSelectedSubmission(submissionId);
        
        if (autoload === "1") {
          // Auto-load after a brief delay to ensure submissions are loaded
          setTimeout(() => {
            loadTraceById(submissionId);
          }, 300);
        }
      }
    }
  }, [searchParams]);

  const loadRecentSubmissions = () => {
    const isDev = (import.meta as any)?.env?.DEV === true;
    const consoleUrl = `${API_BASE}/api/console/work-queue?limit=50`;
    if (isDev) {
      console.log("[Connected] Submissions list URL:", consoleUrl);
    }

    getWorkQueue(undefined, undefined, 50)
      .then((response) => {
        const submissions = response.items.map(mapWorkQueueSubmission);
        const deduped = submissions.filter((sub, idx, arr) =>
          arr.findIndex((item) => item.id === sub.id) === idx
        );
        const sorted = deduped.sort((a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );

        console.log("[Connected] Loaded submissions from console API:", sorted.length);
        setRecentSubmissions(sorted);
        if (sorted.length > 0 && !selectedSubmission) {
          setSelectedSubmission(sorted[0].id);
        }
      })
      .catch((err: any) => {
        console.warn("[Connected] Console API failed, falling back to demoStore:", err);
        try {
          const allSubmissions = demoStore.getRecentSubmissionsByType('csf', 50);
          const seen = new Set<string>();
          const deduped = allSubmissions.filter(sub => {
            if (seen.has(sub.id)) return false;
            seen.add(sub.id);
            return true;
          });
          const sorted = deduped.sort((a, b) =>
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          );
          console.log('[Connected] Loaded submissions from demoStore:', sorted.length);
          setRecentSubmissions(sorted);
          if (sorted.length > 0 && !selectedSubmission) {
            setSelectedSubmission(sorted[0].id);
          }
        } catch (fallbackErr: any) {
          console.error("Failed to load recent submissions:", fallbackErr);
          setError(fallbackErr.message || "Failed to load submissions");
        }
      });
  };

  const loadTraceById = async (submissionId: string) => {
    setState("loading");
    setError(null);
    setLoadedTrace(null);
    setSelectedSubmissionPayload(null);
    console.log("[Connected] Loading submission by id:", submissionId);
    const isDev = (import.meta as any)?.env?.DEV === true;
    const detailUrl = `${API_BASE}/api/console/submissions/${submissionId}`;
    if (isDev) {
      console.log("[Connected] Submission detail URL:", detailUrl);
    }

    try {
      const detail = await getConsoleSubmission(submissionId);
      const submission = mapWorkQueueSubmission(detail);
      const payload = extractPayload({ payload: submission.payload }) || {};
      const payloadKeys = payload ? Object.keys(payload).length : 0;
      console.log("[Connected] Loaded submission payload keys:", payloadKeys);
      
      setLoadedTrace(submission);
      setSelectedSubmission(submissionId);
      const schemaKey = resolveSchemaKey(detail.csf_type || detail.title || detail.tenant);
      setSelectedSchemaKey(schemaKey);
      setSelectedSubmissionPayload(payloadKeys > 0 ? payload : null);
      const hasPayload = payload && Object.keys(payload).length > 0;
      const schema = completenessSchemas[schemaKey] || completenessSchemas.default;
      const completeness = hasPayload ? computeCompleteness(payload, schema) : null;
      setCompletenessScore(completeness);
      
      // Load audit events for timeline
      const workQueue = demoStore.getWorkQueue();
      const queueItem = workQueue.find((item) => item.submissionId === submission.id);
      if (queueItem) {
        const events = demoStore.getAuditEvents(queueItem.id);
        setAuditEvents(events);
      } else {
        setAuditEvents([]);
      }
      
      setState("idle");
      setReadyBanner(`Loaded ${submission.displayName} from ${new Date(submission.submittedAt).toLocaleString()}`);
      setTimeout(() => setReadyBanner(null), 3000);
    } catch (err: any) {
      console.warn("[Connected] Console submission load failed, trying demoStore:", err);
      const fallback = demoStore.getSubmission(submissionId);
      if (fallback) {
        setLoadedTrace(fallback);
        setSelectedSubmission(submissionId);
        setSelectedSubmissionPayload(fallback.payload || null);
        const hasPayload = fallback.payload && Object.keys(fallback.payload).length > 0;
        const schemaKey = resolveSchemaKey(fallback.csfType || fallback.kind || fallback.displayName);
        setSelectedSchemaKey(schemaKey);
        const schema = completenessSchemas[schemaKey] || completenessSchemas.default;
        const completeness = hasPayload ? computeCompleteness(fallback.payload, schema) : null;
        setCompletenessScore(completeness);
        setState("idle");
        return;
      }
      console.error("Load trace error:", err);
      setError(err.message || "Failed to load submission");
      setState("error");
    }
  };

  const loadTraceByTraceId = async (traceId: string) => {
    setState("loading");
    setError(null);
    setLoadedTrace(null);
    setSelectedSubmissionPayload(null);
    console.log("[Connected] Loading submission by trace id:", traceId);

    try {
      const response = await getWorkQueue(undefined, undefined, 200);
      const match = response.items.find(
        (item) => item.trace_id === traceId || item.submission_id === traceId
      );

      if (!match) {
        throw new Error(`Submission with trace ID ${traceId} not found. Please refresh the Compliance Console.`);
      }

      const submission = mapWorkQueueSubmission(match);
      const payload = extractPayload({ payload: submission.payload }) || {};
      const payloadKeys = payload ? Object.keys(payload).length : 0;
      console.log("[Connected] Loaded trace payload keys:", payloadKeys);
      
      setLoadedTrace(submission);
      setSelectedSubmission(submission.id);
      const schemaKey = resolveSchemaKey(match.csf_type || match.title || match.tenant);
      setSelectedSchemaKey(schemaKey);
      setSelectedSubmissionPayload(payloadKeys > 0 ? payload : null);
      const hasPayload = payload && Object.keys(payload).length > 0;
      const schema = completenessSchemas[schemaKey] || completenessSchemas.default;
      const completeness = hasPayload ? computeCompleteness(payload, schema) : null;
      setCompletenessScore(completeness);
      
      // Load audit events for timeline
      const workQueue = demoStore.getWorkQueue();
      const queueItem = workQueue.find((item) => item.submissionId === submission.id);
      if (queueItem) {
        const events = demoStore.getAuditEvents(queueItem.id);
        setAuditEvents(events);
      } else {
        setAuditEvents([]);
      }
      
      setState("idle");
      setReadyBanner(`Loaded ${submission.displayName} from ${new Date(submission.submittedAt).toLocaleString()}`);
      setTimeout(() => setReadyBanner(null), 3000);
    } catch (err: any) {
      console.error("Load trace error:", err);
      setError(err.message || "Failed to load submission");
      setState("error");
    }
  };

  const handleLoadSubmission = () => {
    if (!selectedSubmission) {
      setError("Please select a submission");
      return;
    }
    console.log("[Connected] Load Submission clicked:", selectedSubmission);
    loadTraceById(selectedSubmission);
  };

  const handleExplain = async () => {
    setState("loading");
    setError(null);
    setResult(null);
    setNormalizedTrace(null);
    const isDev = (import.meta as any)?.env?.DEV === true;
    const explainUrl = `${API_BASE}/rag/regulatory-explain`;
    if (isDev) {
      console.log("[Explain] Endpoint URL:", explainUrl);
    }

    try {
      if (decisionSource === "sandbox") {
        // Sandbox mode: call evaluator as before
        if (!selectedScenario) {
          throw new Error("No scenario selected");
        }
        
        const mockScenarios = get_mock_scenarios();
        const scenario = mockScenarios.find(s => s.id === selectedScenario);
        
        if (!scenario) {
          throw new Error("Scenario not found");
        }

        const response = await ragExplain(
          scenario.decision_type,
          scenario.engine_family,
          scenario.evidence,
          `Explain why this ${scenario.decision_type} decision resulted in the current outcome.`
        );

        console.log("[Sandbox] ragExplain response:", response);
        console.log("[Sandbox] Explain fired_rules:", response.debug?.fired_rules?.length || 0);
        setResult(response);
        
        if (response.debug?.fired_rules?.length > 0) {
          setState("success");
        } else {
          setState("empty");
        }
        
        // Compute explainability quality metrics
        const csfType = scenario.decision_type || 'csf_practitioner';
        const payload = scenario.evidence || {};
        const schemaKey = resolveSchemaKey(scenario.decision_type);
        const schema = completenessSchemas[schemaKey] || completenessSchemas.default;
        setSelectedSchemaKey(schemaKey);
        const firedRuleIds = (response.debug?.fired_rules || []).map((r: any) => r.id || r.ruleId);
        const hasPayload = payload && Object.keys(payload).length > 0;
        
        console.log("[Sandbox] Explain completed:", { scenario: scenario.id, hasPayload, firedRuleCount: firedRuleIds.length });
        setSelectedSubmissionPayload(payload);
        
        // Completeness
        const completeness = hasPayload ? computeCompleteness(payload, schema) : null;
        setCompletenessScore(completeness);
        
        // Counterfactuals
        const counterf = generateCounterfactuals(csfType, payload, firedRuleIds, 5);
        setCounterfactuals(counterf);
        
        // Request info
        if (completeness) {
          const reqInfo = generateRequestInfoMessage(
            {
              scorePct: completeness.scorePct,
              presentCount: completeness.presentCount,
              totalCount: completeness.totalCount,
              missing: completeness.missing,
              missingFieldDetails: []
            } as CompletenessScore,
            scenario.id || null,
            csfType
          );
          setRequestInfo(reqInfo);
        } else {
          setRequestInfo(null);
        }
      } else {
        // Connected mode: Trace-first with evaluator fallback
        if (!loadedTrace) {
          throw new Error("No trace loaded. Please select and load a submission first.");
        }
        
        console.log("[Connected] Loading stored trace from submission:", {
          submission_id: loadedTrace.id,
          trace_id: loadedTrace.traceId,
          has_decisionTrace: !!loadedTrace.decisionTrace,
          has_payload: !!loadedTrace.payload
        });

        // TRACE-FIRST: If decisionTrace exists, use it directly
        if (loadedTrace.decisionTrace) {
          console.log("[Connected] Using decisionTrace (trace-first mode)");
          const normalized = normalizeTrace(loadedTrace.decisionTrace);
          setNormalizedTrace(normalized);
          console.log("[Connected] Trace fired_rules:", normalized.fired_rules.length);
          
          // Determine state based on trace content
          if (normalized.outcome === "approved" && normalized.fired_rules.length === 0) {
            setState("success");
          } else if (normalized.fired_rules.length > 0 || normalized.missing_evidence.length > 0 || normalized.next_steps.length > 0) {
            setState("success");
          } else {
            setState("empty");
          }
          
          // Compute explainability quality metrics
          const csfType = loadedTrace.kind || 'csf_practitioner';
          const payload = loadedTrace.payload || {};
          const schemaKey = resolveSchemaKey(loadedTrace.csfType || csfType);
          const schema = completenessSchemas[schemaKey] || completenessSchemas.default;
          setSelectedSchemaKey(schemaKey);
          const firedRuleIds = normalized.fired_rules.map(r => r.id);
          const hasPayload = payload && Object.keys(payload).length > 0;
          setSelectedSubmissionPayload(payload);
          
          // Completeness
          const completeness = hasPayload ? computeCompleteness(payload, schema) : null;
          setCompletenessScore(completeness);
          
          // Counterfactuals
          const counterf = generateCounterfactuals(csfType, payload, firedRuleIds, 5);
          setCounterfactuals(counterf);
          
          // Request info
          if (completeness) {
            const reqInfo = generateRequestInfoMessage(
              {
                scorePct: completeness.scorePct,
                presentCount: completeness.presentCount,
                totalCount: completeness.totalCount,
                missing: completeness.missing,
                missingFieldDetails: []
              } as CompletenessScore,
              loadedTrace.id || null,
              csfType
            );
            setRequestInfo(reqInfo);
          } else {
            setRequestInfo(null);
          }
        } 
        // EVALUATOR FALLBACK: If no decisionTrace, run evaluator
        else if (loadedTrace.payload) {
          console.log("[Connected] No decisionTrace found - falling back to evaluator");
          
          // Extract decision_type and evidence from payload
          const decision_type = loadedTrace.kind || 'csf';
          const evidence = loadedTrace.payload;
          
          const response = await ragExplain(
            decision_type,
            'csf',
            evidence,
            `Explain this ${decision_type} submission.`
          );

          console.log("[Connected] Evaluator fallback response:", response);
          console.log("[Connected] Evaluator fired_rules:", response.debug?.fired_rules?.length || 0);
          setResult(response);
          
          if (response.debug?.fired_rules?.length > 0) {
            setState("success");
          } else {
            setState("empty");
          }
          
          // Compute explainability quality metrics
          const csfType = loadedTrace.kind || 'csf_practitioner';
          const payload = loadedTrace.payload || {};
          const schemaKey = resolveSchemaKey(loadedTrace.csfType || csfType);
          const schema = completenessSchemas[schemaKey] || completenessSchemas.default;
          setSelectedSchemaKey(schemaKey);
          const firedRuleIds = (response.debug?.fired_rules || []).map((r: any) => r.id || r.ruleId);
          const hasPayload = payload && Object.keys(payload).length > 0;
          setSelectedSubmissionPayload(payload);
          
          // Completeness
          const completeness = hasPayload ? computeCompleteness(payload, schema) : null;
          setCompletenessScore(completeness);
          
          // Counterfactuals
          const counterf = generateCounterfactuals(csfType, payload, firedRuleIds, 5);
          setCounterfactuals(counterf);
          
          // Request info
          if (completeness) {
            const reqInfo = generateRequestInfoMessage(
              {
                scorePct: completeness.scorePct,
                presentCount: completeness.presentCount,
                totalCount: completeness.totalCount,
                missing: completeness.missing,
                missingFieldDetails: []
              } as CompletenessScore,
              loadedTrace.id || null,
              csfType
            );
            setRequestInfo(reqInfo);
          } else {
            setRequestInfo(null);
          }
        } else {
          throw new Error("No trace data or payload found in submission");
        }
      }
    } catch (err: any) {
      console.error("Explain error:", err);
      setError(err.message || "Failed to explain decision");
      setState("error");
    }
  };

  const getOutcomeBadge = (outcome: string) => {
    const badges = {
      approved: "bg-green-500/20 text-green-400 border-green-500/30",
      needs_review: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      blocked: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    
    const labels = {
      approved: "✅ APPROVED",
      needs_review: "⚠️ NEEDS REVIEW",
      blocked: "❌ BLOCKED",
    };

    const badgeClass = badges[outcome as keyof typeof badges] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
    const label = labels[outcome as keyof typeof labels] || outcome.toUpperCase();

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-md border text-sm font-semibold ${badgeClass}`}>
        {label}
      </span>
    );
  };

  const groupRulesBySeverity = (firedRules: FiredRule[]) => {
    const groups = {
      block: firedRules.filter(r => r.severity === "block"),
      review: firedRules.filter(r => r.severity === "review"),
      info: firedRules.filter(r => r.severity === "info"),
    };
    return groups;
  };

  const renderRule = (rule: FiredRule, index: number) => {
    // Extract evidence from rule (max 3)
    const evidenceChips = rule.evidence?.slice(0, 3) || [];

    return (
      <div
        key={rule.id}
        className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2.5 text-[11px]"
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="font-medium text-zinc-100">{rule.title}</div>
          {canViewRuleIds(role) && rule.citation && (
            <div className="text-[10px] text-zinc-400 font-mono shrink-0">
              {rule.citation}
            </div>
          )}
        </div>
        
        <div className="text-zinc-50 mb-2 leading-relaxed">{rule.requirement}</div>
        
        {/* Evidence chips - Verifier/Admin only */}
        {canViewEvidence(role) && evidenceChips.length > 0 && (
          <div className="mb-2">
            <div className="text-[10px] font-semibold text-zinc-400 mb-1">Evidence:</div>
            <div className="flex flex-wrap gap-1.5">
              {evidenceChips.map((ev, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    // Convert EvidenceChip to EvidenceItem and open drawer
                    const evidence: EvidenceItem = {
                      id: ev.resultId ?? `evidence-${rule.id}-${idx}`,
                      label: ev.docTitle,
                      jurisdiction: ev.jurisdiction ?? rule.jurisdiction,
                      citation: ev.section ?? rule.citation,
                      snippet: ev.snippet,
                      decisionType: rule.severity,
                      tags: [rule.severity],
                    };
                    handleOpenEvidence(evidence);
                  }}
                  className="inline-flex items-center px-2 py-1 rounded-md bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30 transition-colors text-[10px] font-medium"
                  title={ev.snippet || ev.section || 'View evidence'}
                >
                  📄 {ev.docTitle}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {canViewRuleIds(role) && (
          <div className="flex items-center gap-2 text-[10px] text-zinc-400">
            <span>{rule.jurisdiction}</span>
            <span>•</span>
            <span className="font-mono">{rule.id}</span>
          </div>
        )}
      </div>
    );
  };

  const activeFiredRules = normalizedTrace?.fired_rules ?? (result?.debug?.fired_rules || []);
  const activeDrivers = normalizedTrace?.drivers ?? (result?.debug?.drivers || []);
  const missingBlockCount = completenessScore?.missingByCategory.block.length ?? 0;
  const missingReviewCount = completenessScore?.missingByCategory.review.length ?? 0;
  const hasPayload = !!selectedSubmissionPayload && Object.keys(selectedSubmissionPayload).length > 0;
  const completenessPct = completenessScore?.scorePct ?? null;

  const decisionStatusLabel = (() => {
    if (normalizedTrace?.outcome) {
      if (normalizedTrace.outcome === "approved") return "Approved";
      if (normalizedTrace.outcome === "blocked") return "Blocked";
      if (normalizedTrace.outcome === "needs_review") return "Needs Review";
    }
    if (missingBlockCount > 0) return "Blocked";
    if (missingReviewCount > 0) return "Needs Review";
    if (hasPayload && completenessPct !== null && completenessPct >= 80) return "Approved";
    if (hasPayload) return "Pending Review";
    return "Unknown";
  })();

  const decisionRiskLabel = (() => {
    if (normalizedTrace?.risk_level) return normalizedTrace.risk_level;
    if (missingBlockCount > 0) return "High";
    if (missingReviewCount > 0) return "Medium";
    if (completenessPct !== null && completenessPct >= 90) return "Low";
    if (completenessPct !== null && completenessPct >= 70) return "Moderate";
    if (hasPayload) return "Moderate";
    return "Unknown";
  })();

  const topMissingFields = completenessScore
    ? [...completenessScore.missingByCategory.block, ...completenessScore.missingByCategory.review]
        .slice(0, 4)
        .map((field) => field.label)
    : [];

  const selectedSubmissionLabel = (() => {
    const sub = filteredSubmissions.find((item) => item.id === selectedSubmission);
    if (!sub) return "Select a submission";
    const queueItem = demoStore.getWorkQueue().find((item) => item.submissionId === sub.id);
    const status = queueItem?.status || "submitted";
    return `${sub.displayName} · ${status} · ${new Date(sub.submittedAt).toLocaleString()}`;
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Decision Explainability
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Based on submission data, policy rules, and cited regulatory sources.
          </p>
        </div>
      </div>

      {/* Decision Source Selector - Hidden for Submitters */}
      {canUseConnectedMode(role) && (
        <div className="flex items-center gap-2">
          <label htmlFor="decision-source" className="text-[11px] text-zinc-400 shrink-0">
            Decision Source:
          </label>
          <select
            id="decision-source"
            value={decisionSource}
            onChange={(e) => {
              setDecisionSource(e.target.value as DecisionSource);
              setResult(null);
              setError(null);
              setState("idle");
              setLoadedTrace(null);
              setSelectedSubmissionPayload(null);
              setCompletenessScore(null);
              setRequestInfo(null);
            }}
            className="flex-1 px-3 py-1.5 text-[11px] bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="sandbox">Sandbox scenarios (pre-defined)</option>
            <option value="connected">Connected mode (recent submissions)</option>
          </select>
        </div>
      )}

      {/* Scenario Selector (only for sandbox mode) */}
      {decisionSource === "sandbox" && (
        <div className="space-y-2">
          {/* Decision Type Filter Badge */}
          {searchParams.get("decisionType") && (
            <div className="flex items-center gap-2 text-[10px] text-blue-400 bg-blue-950 border border-blue-800 rounded-md px-2 py-1">
              <span>🎯 Filtered to: <strong>{searchParams.get("decisionType")}</strong></span>
              <span className="text-zinc-500">({scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''})</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <label htmlFor="scenario" className="text-[11px] text-zinc-400 shrink-0">
              Scenario:
            </label>
            <select
              id="scenario"
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="flex-1 px-3 py-1.5 text-[11px] bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Connected Mode: Submissions dropdown + Load button */}
      {decisionSource === "connected" && (
        <div className="space-y-3">
          {/* Submission dropdown */}
          <div className="flex items-start gap-2">
            <label htmlFor="submission" className="text-[11px] text-zinc-400 shrink-0 pt-2">
              Submission:
            </label>
            <div className="relative flex-1">
              <button
                id="submission"
                type="button"
                onClick={() => setSubmissionMenuOpen((prev) => !prev)}
                className="w-full px-3 py-2 text-left text-[11px] bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {filteredSubmissions.length === 0 ? "No submissions found. Submit a CSF to load connected mode." : selectedSubmissionLabel}
              </button>
              {submissionMenuOpen && filteredSubmissions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 shadow-lg">
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-500">Latest 5</div>
                  <div className="max-h-40 overflow-y-auto border-b border-zinc-800">
                    {filteredSubmissions.slice(0, 5).map((sub) => {
                      const queueItem = demoStore.getWorkQueue().find((item) => item.submissionId === sub.id);
                      const status = queueItem?.status || "submitted";
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setSelectedSubmission(sub.id);
                            setSubmissionMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-[11px] text-zinc-200 hover:bg-zinc-800"
                        >
                          {sub.displayName} · {status} · {new Date(sub.submittedAt).toLocaleString()}
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-zinc-500">All submissions</div>
                  <div className="max-h-56 overflow-y-auto">
                    {filteredSubmissions.slice(5).map((sub) => {
                      const queueItem = demoStore.getWorkQueue().find((item) => item.submissionId === sub.id);
                      const status = queueItem?.status || "submitted";
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setSelectedSubmission(sub.id);
                            setSubmissionMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-[11px] text-zinc-200 hover:bg-zinc-800"
                        >
                          {sub.displayName} · {status} · {new Date(sub.submittedAt).toLocaleString()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Load button - right aligned, normal size */}
          <div className="flex justify-end">
            <button
              onClick={handleLoadSubmission}
              disabled={state === "loading" || !selectedSubmission}
              className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-md transition-colors"
            >
              {state === "loading" ? "Loading..." : "Load Selected Submission"}
            </button>
          </div>

          {loadedTrace && (
            <div className="text-[11px] text-zinc-400">
              ✓ Loaded {loadedTrace.displayName} from {new Date(loadedTrace.submittedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Ready banner when explain request received */}
      {readyBanner && (
        <div className="rounded-lg bg-blue-600/20 border border-blue-500/40 px-3 py-2">
          <p className="text-xs text-blue-200">
            {readyBanner}
          </p>
        </div>
      )}

      {/* Explain Button */}
      <div>
        <button
          onClick={handleExplain}
          disabled={
            state === "loading" || 
            (decisionSource === "sandbox" && !selectedScenario) ||
            (decisionSource === "connected" && (!loadedTrace || !selectedSubmissionPayload || Object.keys(selectedSubmissionPayload).length === 0))
          }
          className="px-4 py-1.5 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-md transition-colors"
        >
          {state === "loading" ? "Explaining..." : "Explain Decision"}
        </button>
      </div>

      {/* Debug Info */}
      {aiDebugEnabled && result && (
        <div className="text-[9px] text-zinc-600 font-mono">
          Debug: outcome={result.debug?.outcome} | rules={result.debug?.fired_rules_count} | missing={result.debug?.missing_evidence_count} | steps={result.debug?.next_steps_count}
        </div>
      )}

      {/* Loading State */}
      {state === "loading" && (
        <div className="flex items-center justify-center py-12 text-zinc-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin"></div>
            <span className="text-sm">Evaluating decision...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {state === "error" && error && (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-[11px] text-red-400">
          <div className="font-semibold mb-1">Error</div>
          <div>{error}</div>
        </div>
      )}

      {/* Empty State */}
      {state === "empty" && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-sm font-semibold text-zinc-300 mb-2">No rules fired</div>
          <div className="text-xs text-zinc-400 mb-6 max-w-md">
            This submission likely contains complete data and meets all regulatory requirements.
          </div>
          
          {/* CTAs */}
          <div className="flex flex-col gap-3 w-full max-w-sm">
            <button
              onClick={() => {
                setDecisionSource('sandbox');
                setState('idle');
                setNormalizedTrace(null);
                setResult(null);
                // Auto-select a blocked scenario
                const mockScenarios = get_mock_scenarios();
                const blockedScenario = mockScenarios.find(s => s.name.toLowerCase().includes('blocked'));
                if (blockedScenario) {
                  setSelectedScenario(blockedScenario.id);
                }
              }}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Try a BLOCKED sandbox scenario
            </button>
          </div>
        </div>
      )}

      {/* Success State */}
      {state === "success" && (result || normalizedTrace) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getOutcomeBadge(normalizedTrace ? normalizedTrace.outcome : result!.debug.outcome)}
              <div>
                <div className="text-[12px] font-semibold text-zinc-200">Decision summary</div>
                <div className="text-[11px] text-zinc-400">
                  {normalizedTrace?.decision_summary && normalizedTrace.decision_summary.trim().length > 0
                    ? normalizedTrace.decision_summary
                    : result?.answer && result.answer.trim().length > 0
                      ? result.answer
                      : activeFiredRules.length > 0
                        ? `Decision based on ${activeFiredRules.length} fired rule${activeFiredRules.length !== 1 ? "s" : ""}.`
                        : topMissingFields.length > 0
                          ? `Decision pending due to missing ${topMissingFields.length} required field${topMissingFields.length !== 1 ? "s" : ""}.`
                          : "No rule evidence returned yet. Load submission payload and run Explain Decision."}
                </div>
              </div>
            </div>

            {canDownloadPackets(role) && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const packet = buildDecisionPacket(
                      normalizedTrace
                        ? { normalizedTrace, sourceType: 'rag_explorer' }
                        : result
                          ? { explainResponse: result, sourceType: 'rag_explorer' }
                          : { trace: { source_type: 'rag_explorer' } }
                    );
                    downloadJson(packet);
                  }}
                  className="px-3 py-1.5 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center gap-1.5"
                  title="Download decision packet as JSON for API integration"
                >
                  <span>📦</span>
                  <span>Export JSON</span>
                </button>
                {canExportHtml(role) && (
                  <button
                    onClick={() => {
                      const packet = buildDecisionPacket(
                        normalizedTrace
                          ? { normalizedTrace, sourceType: 'rag_explorer' }
                          : result
                            ? { explainResponse: result, sourceType: 'rag_explorer' }
                            : { trace: { source_type: 'rag_explorer' } }
                      );
                      const html = generateDecisionPacketHtml(packet);
                      downloadHtml(packet, html);
                    }}
                    className="px-3 py-1.5 text-[11px] font-medium bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors flex items-center gap-1.5"
                    title="Download as HTML for printing or audit records"
                  >
                    <span>📄</span>
                    <span>Export HTML</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Decision status</div>
              <div className="text-lg font-semibold text-zinc-100 mt-1">{decisionStatusLabel}</div>
              <div className="text-[11px] text-zinc-400 mt-1">
                {activeFiredRules.length} fired rule{activeFiredRules.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Risk level</div>
              <div className="text-lg font-semibold text-zinc-100 mt-1">{decisionRiskLabel}</div>
              <div className="text-[11px] text-zinc-400 mt-1">
                {missingBlockCount > 0 ? `${missingBlockCount} BLOCK gaps` : missingReviewCount > 0 ? `${missingReviewCount} REVIEW gaps` : "No blocking gaps detected"}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Completeness</div>
              <div className="text-lg font-semibold text-zinc-100 mt-1">
                {hasPayload && completenessPct !== null ? `${completenessPct}%` : "Not available"}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">
                {hasPayload && completenessScore ? `${completenessScore.presentCount}/${completenessScore.totalCount} fields present` : "Load submission payload"}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3">
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">Decision basis</div>
              <div className="text-[12px] font-semibold text-zinc-100 mt-1">
                {activeDrivers.length > 0 ? "Rule drivers" : topMissingFields.length > 0 ? "Missing data" : "Policy rules"}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">
                {activeDrivers.length > 0
                  ? activeDrivers.slice(0, 3).map((driver: any) => driver.label).join(", ")
                  : topMissingFields.length > 0
                    ? topMissingFields.join(", ")
                    : "No critical data gaps detected"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3">
              <div className="text-xs font-semibold text-zinc-200 mb-2">Evidence & rule drivers</div>
              {(normalizedTrace?.missing_evidence?.length || result?.debug.missing_evidence?.length) && (
                <div className="mb-3">
                  <div className="text-[11px] text-amber-200 font-semibold mb-1">Missing evidence</div>
                  <ul className="space-y-1">
                    {(normalizedTrace?.missing_evidence || result?.debug.missing_evidence || []).map((item, idx) => (
                      <li key={idx} className="text-[11px] text-amber-100/80 flex items-start gap-2">
                        <span className="shrink-0">•</span>
                        <span>{String(item).replace(/\n/g, " ").replace(/\s+/g, " ").trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(normalizedTrace?.next_steps?.length || result?.debug.next_steps?.length) && (
                <div className="mb-3">
                  <div className="text-[11px] text-blue-200 font-semibold mb-1">Next steps</div>
                  <ul className="space-y-1">
                    {(normalizedTrace?.next_steps || result?.debug.next_steps || []).map((step, idx) => (
                      <li key={idx} className="text-[11px] text-blue-100/80 flex items-start gap-2">
                        <span className="shrink-0">•</span>
                        <span>{String(step).replace(/\n/g, " ").replace(/\s+/g, " ").trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {canViewFiredRules(role) && (activeFiredRules.length > 0 || activeDrivers.length > 0) ? (
                <div className="space-y-2">
                  <div className="text-[11px] text-zinc-300 font-semibold">
                    Evidence drivers ({Math.max(activeFiredRules.length, activeDrivers.length)})
                  </div>
                  {activeFiredRules.length > 0 ? (
                    (() => {
                      const groups = groupRulesBySeverity(activeFiredRules);
                      return (
                        <>
                          {groups.block.length > 0 && (
                            <div>
                              <div className="text-[11px] font-semibold text-red-300 mb-1">🚫 Block ({groups.block.length})</div>
                              <div className="space-y-1.5">
                                {groups.block.map((rule, idx) => renderRule(rule, idx))}
                              </div>
                            </div>
                          )}
                          {groups.review.length > 0 && (
                            <div>
                              <div className="text-[11px] font-semibold text-yellow-300 mb-1">⚠️ Review ({groups.review.length})</div>
                              <div className="space-y-1.5">
                                {groups.review.map((rule, idx) => renderRule(rule, idx))}
                              </div>
                            </div>
                          )}
                          {groups.info.length > 0 && (
                            <div>
                              <div className="text-[11px] font-semibold text-blue-300 mb-1">ℹ️ Info ({groups.info.length})</div>
                              <div className="space-y-1.5">
                                {groups.info.map((rule, idx) => renderRule(rule, idx))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <div className="space-y-1">
                      {activeDrivers.slice(0, 6).map((driver: any, idx: number) => (
                        <div key={idx} className="rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-[11px]">
                          <div className="text-zinc-100 font-medium">{driver.label}</div>
                          {driver.details && (
                            <div className="text-zinc-400 mt-1">{driver.details}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-zinc-500">No fired rules to display.</div>
              )}
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-3">
              <div className="text-xs font-semibold text-zinc-200 mb-1">Data completeness</div>
              <div className="text-[10px] text-zinc-500 mb-2">
                Schema: {completenessSchemas[selectedSchemaKey]?.label || "Not selected"}
              </div>
              {!hasPayload && (
                <div className="text-[11px] text-zinc-400">
                  {selectedSchemaKey === "default"
                    ? "Schema not selected yet. Load a submission payload to determine the correct completeness checks."
                    : "No payload loaded yet. Load a submission or run Explain Decision."}
                </div>
              )}
              {hasPayload && completenessScore && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-zinc-400">Required fields present</div>
                    <div className={`text-sm font-semibold ${
                      completenessScore.scorePct >= 90 ? "text-green-400" :
                      completenessScore.scorePct >= 70 ? "text-yellow-400" :
                      "text-red-400"
                    }`}>
                      {completenessScore.scorePct}%
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {completenessScore.presentCount} of {completenessScore.totalCount} fields present
                  </div>
                  {completenessScore.missingByCategory.block.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-red-300 mb-1">Missing BLOCK</div>
                      <ul className="space-y-1">
                        {completenessScore.missingByCategory.block.map((field) => (
                          <li key={field.label} className="text-[11px] text-red-200/80">• {field.label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {completenessScore.missingByCategory.review.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-yellow-300 mb-1">Missing REVIEW</div>
                      <ul className="space-y-1">
                        {completenessScore.missingByCategory.review.map((field) => (
                          <li key={field.label} className="text-[11px] text-yellow-200/80">• {field.label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {completenessScore.missingByCategory.info.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-blue-300 mb-1">Missing INFO</div>
                      <ul className="space-y-1">
                        {completenessScore.missingByCategory.info.map((field) => (
                          <li key={field.label} className="text-[11px] text-blue-200/80">• {field.label}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {completenessScore.scorePct === 100 && (
                    <div className="text-[11px] text-green-300">✓ All required fields are present</div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Counterfactuals - Why Other Rules Did Not Fire - Verifier/Admin only */}
          {canViewCounterfactuals(role) && counterfactuals.length > 0 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3">
              <div className="text-sm font-bold text-zinc-100 mb-3">
                🔍 Why Other Rules Did Not Fire
              </div>
              
              <div className="text-xs text-zinc-400 mb-3">
                These rules were evaluated but did not trigger. Understanding why can help improve data quality.
              </div>
              
              <div className="space-y-2">
                {counterfactuals.map((cf, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5 text-[11px]"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-200">{cf.title}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          cf.severity === 'block' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          cf.severity === 'review' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {cf.severity.toUpperCase()}
                        </span>
                      </div>
                      {cf.citation && (
                        <div className="text-[10px] text-zinc-500 font-mono shrink-0">
                          {cf.citation}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-zinc-300 mb-1.5 leading-relaxed">
                      <span className="text-zinc-400">Why not:</span> {cf.whyNot}
                    </div>
                    
                    <div className="text-zinc-400 leading-relaxed">
                      <span className="text-zinc-500">To satisfy:</span> {cf.toSatisfy}
                    </div>
                    
                    {cf.jurisdiction && (
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-1.5">
                        <span>{cf.jurisdiction}</span>
                        <span>•</span>
                        <span className="font-mono">{cf.ruleId}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {counterfactuals.length === 5 && (
                <div className="text-[10px] text-zinc-500 mt-2 italic">
                  Showing top 5 non-triggered rules. Additional rules may exist.
                </div>
              )}
            </div>
          )}
          
          {/* Request Missing Information */}
          {requestInfo && requestInfo.missingFieldsCount > 0 && (
            <div className="rounded-lg border border-blue-600/50 bg-blue-950/30 px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-blue-200">
                  ✉️ Request Missing Information
                </div>
                <div className="text-xs text-blue-300">
                  {requestInfo.missingFieldsCount} field{requestInfo.missingFieldsCount !== 1 ? 's' : ''} missing
                </div>
              </div>
              
              <div className="text-xs text-blue-200/80 mb-3">
                Copy this message to request missing data from the submitter:
              </div>
              
              <div className="relative">
                <textarea
                  readOnly
                  value={requestInfo.message}
                  className="w-full h-48 px-3 py-2 text-[11px] font-mono bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(requestInfo.message);
                    // Could add a toast notification here
                  }}
                  className="px-3 py-1.5 text-[11px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                >
                  📋 Copy to Clipboard
                </button>
                <button
                  onClick={() => {
                    // Reset to original template
                    if (completenessScore && loadedTrace) {
                      const csfType = loadedTrace.kind || 'csf_practitioner';
                      const reqInfo = generateRequestInfoMessage(
                        {
                          scorePct: completenessScore.scorePct,
                          presentCount: completenessScore.presentCount,
                          totalCount: completenessScore.totalCount,
                          missing: completenessScore.missing,
                          missingFieldDetails: []
                        } as CompletenessScore,
                        loadedTrace.id || null,
                        csfType
                      );
                      setRequestInfo(reqInfo);
                    }
                  }}
                  className="px-3 py-1.5 text-[11px] font-medium bg-zinc-700 hover:bg-zinc-600 text-white rounded-md transition-colors"
                >
                  🔄 Reset Template
                </button>
              </div>
            </div>
          )}
          
          {/* Case Timeline - Connected Mode Only */}
          {decisionSource === "connected" && loadedTrace && auditEvents.length > 0 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3 mt-3">
              <h3 className="text-sm font-bold text-zinc-100 mb-4">
                📅 Case Timeline
              </h3>
              <div className="text-xs text-zinc-400 mb-4">
                Track all actions and status changes for this submission.
              </div>
              <Timeline events={auditEvents} compact />
            </div>
          )}
        </div>
      )}

      {/* Evidence Drawer */}
      <EvidenceDrawer
        open={evidenceDrawerOpen}
        onClose={handleCloseEvidence}
        evidence={selectedEvidence}
        caseId={caseId}
      />
    </div>
  );
}
