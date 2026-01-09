import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ragExplain, type DecisionExplainResponse } from "../../api/ragClient";
import { get_mock_scenarios } from "../../api/mockScenarios";
import { useRagDebug } from "../../devsupport/RagDebugContext";
import { demoStore } from "../../lib/demoStore";
import type { Submission } from "../../types/workQueue";
import { normalizeTrace, type NormalizedTrace } from "../../lib/traceNormalizer";
import { buildDecisionPacket } from "../../utils/buildDecisionPacket";
import { downloadJson, downloadHtml } from "../../utils/exportPacket";
import { generateDecisionPacketHtml } from "../../templates/decisionPacketTemplate";
import { calculateCompleteness, getFieldDisplayName, type CompletenessScore } from "../../lib/completenessScorer";
import { generateCounterfactuals, type Counterfactual } from "../../lib/counterfactualGenerator";
import { generateRequestInfoMessage, type RequestInfoTemplate } from "../../lib/requestInfoGenerator";
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
  canViewCompletenessDetails,
  getRagExplorerInstructions
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'blocked' | 'submitted'>('all');
  const [selectedSubmission, setSelectedSubmission] = useState<string>("");
  const [loadedTrace, setLoadedTrace] = useState<Submission | null>(null);
  
  const [state, setState] = useState<RequestState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DecisionExplainResponse | null>(null);
  const [normalizedTrace, setNormalizedTrace] = useState<NormalizedTrace | null>(null);
  const [readyBanner, setReadyBanner] = useState<string | null>(null);
  
  // Explainability quality state
  const [completenessScore, setCompletenessScore] = useState<CompletenessScore | null>(null);
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
    setScenarios(mockScenarios);
    if (mockScenarios.length > 0) {
      setSelectedScenario(mockScenarios[0].id);
    }
  }, []);

  // Load recent submissions when switching to connected mode
  useEffect(() => {
    if (decisionSource === "connected" && recentSubmissions.length === 0) {
      loadRecentSubmissions();
    }
  }, [decisionSource]);

  // Apply status filtering
  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredSubmissions(recentSubmissions);
    } else {
      const workQueue = demoStore.getWorkQueue();
      const filtered = recentSubmissions.filter(sub => {
        const queueItem = workQueue.find(item => item.submissionId === sub.id);
        if (!queueItem) return statusFilter === 'submitted';
        return statusFilter === 'blocked' 
          ? queueItem.status === 'blocked'
          : queueItem.status === 'submitted' || queueItem.status === 'needs_review';
      });
      setFilteredSubmissions(filtered);
    }
  }, [recentSubmissions, statusFilter]);

  // Handle deep linking - auto-load trace from URL params
  useEffect(() => {
    const mode = searchParams.get("mode");
    const submissionId = searchParams.get("submissionId");
    const caseId = searchParams.get("caseId"); // Step 2.4: Support caseId from CaseWorkspace
    const traceId = searchParams.get("traceId");
    const autoload = searchParams.get("autoload");
    
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
            const submission = demoStore.getSubmissions().find(s => s.id === queueItem.submissionId);
            if (submission) {
              window.location.href = `/console/rag?mode=connected&submissionId=${submission.id}`;
            }
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
    try {
      // Load from demoStore
      const allSubmissions = demoStore.getRecentSubmissionsByType('csf', 50);
      
      // Deduplicate by submission.id
      const seen = new Set<string>();
      const deduped = allSubmissions.filter(sub => {
        if (seen.has(sub.id)) return false;
        seen.add(sub.id);
        return true;
      });
      
      // Sort by submittedAt desc
      const sorted = deduped.sort((a, b) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
      
      console.log('[Connected] Loaded submissions from demoStore:', sorted.length);
      setRecentSubmissions(sorted);
      
      if (sorted.length > 0 && !selectedSubmission) {
        setSelectedSubmission(sorted[0].id);
      }
    } catch (err: any) {
      console.error("Failed to load recent submissions:", err);
      setError(err.message || "Failed to load submissions");
    }
  };

  const loadTraceById = (submissionId: string) => {
    setState("loading");
    setError(null);
    setLoadedTrace(null);

    try {
      // Load from demoStore by ID
      const submission = demoStore.getSubmission(submissionId);
      if (!submission) {
        throw new Error(`Submission ${submissionId} not found in store`);
      }
      setLoadedTrace(submission);
      setSelectedSubmission(submissionId);
      
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

  const loadTraceByTraceId = (traceId: string) => {
    setState("loading");
    setError(null);
    setLoadedTrace(null);

    try {
      // Load from demoStore by traceId (for deep linking)
      const submission = demoStore.getSubmissionByTraceId(traceId);
      if (!submission) {
        throw new Error(`Submission with trace ID ${traceId} not found. Please refresh the Compliance Console.`);
      }
      setLoadedTrace(submission);
      setSelectedSubmission(submission.id);
      
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
    loadTraceById(selectedSubmission);
  };

  const handleExplain = async () => {
    setState("loading");
    setError(null);
    setResult(null);
    setNormalizedTrace(null);

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
        setResult(response);
        
        if (response.debug?.fired_rules?.length > 0) {
          setState("success");
        } else {
          setState("empty");
        }
        
        // Compute explainability quality metrics
        const csfType = scenario.decision_type || 'csf_practitioner';
        const payload = scenario.evidence || {};
        const firedRuleIds = (response.debug?.fired_rules || []).map((r: any) => r.id || r.ruleId);
        
        // Completeness
        const completeness = calculateCompleteness(payload, csfType);
        setCompletenessScore(completeness);
        
        // Counterfactuals
        const counterf = generateCounterfactuals(csfType, payload, firedRuleIds, 5);
        setCounterfactuals(counterf);
        
        // Request info
        const reqInfo = generateRequestInfoMessage(
          completeness,
          scenario.id || null,
          csfType
        );
        setRequestInfo(reqInfo);
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
          const firedRuleIds = normalized.fired_rules.map(r => r.id);
          
          // Completeness
          const completeness = calculateCompleteness(payload, csfType);
          setCompletenessScore(completeness);
          
          // Counterfactuals
          const counterf = generateCounterfactuals(csfType, payload, firedRuleIds, 5);
          setCounterfactuals(counterf);
          
          // Request info
          const reqInfo = generateRequestInfoMessage(
            completeness,
            loadedTrace.id || null,
            csfType
          );
          setRequestInfo(reqInfo);
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
          setResult(response);
          
          if (response.debug?.fired_rules?.length > 0) {
            setState("success");
          } else {
            setState("empty");
          }
          
          // Compute explainability quality metrics
          const csfType = loadedTrace.kind || 'csf_practitioner';
          const payload = loadedTrace.payload || {};
          const firedRuleIds = (response.debug?.fired_rules || []).map((r: any) => r.id || r.ruleId);
          
          // Completeness
          const completeness = calculateCompleteness(payload, csfType);
          setCompletenessScore(completeness);
          
          // Counterfactuals
          const counterf = generateCounterfactuals(csfType, payload, firedRuleIds, 5);
          setCounterfactuals(counterf);
          
          // Request info
          const reqInfo = generateRequestInfoMessage(
            completeness,
            loadedTrace.id || null,
            csfType
          );
          setRequestInfo(reqInfo);
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

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Decision Explainability
          </h2>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {getRagExplorerInstructions(role)}
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
      )}

      {/* Connected Mode: Submissions dropdown + Load button */}
      {decisionSource === "connected" && (
        <div className="space-y-3">
          {/* Filter chips */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 shrink-0">Filter:</span>
            <div className="flex gap-2">
              {(['all', 'blocked', 'submitted'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1 text-[10px] font-medium rounded-full transition-colors ${
                    statusFilter === filter
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter === 'blocked' ? 'Blocked' : 'Submitted'}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-zinc-500 ml-auto">
              {filteredSubmissions.length} submission{filteredSubmissions.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Submission dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="submission" className="text-[11px] text-zinc-400 shrink-0">
              Submission:
            </label>
            <select
              id="submission"
              value={selectedSubmission}
              onChange={(e) => setSelectedSubmission(e.target.value)}
              className="flex-1 px-3 py-1.5 text-[11px] bg-zinc-900 border border-zinc-700 rounded-md text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {filteredSubmissions.length === 0 && (
                <option value="">No submissions found for this filter. Try another filter or submit a CSF.</option>
              )}
              {filteredSubmissions.map((sub) => {
                // Get status from work queue if available
                const workQueue = demoStore.getWorkQueue();
                const queueItem = workQueue.find(item => item.submissionId === sub.id);
                const status = queueItem?.status || 'submitted';
                
                return (
                  <option key={sub.id} value={sub.id}>
                    {sub.displayName} | {status} | {new Date(sub.submittedAt).toLocaleString()}
                  </option>
                );
              })}
            </select>
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
            (decisionSource === "connected" && !loadedTrace)
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
            {decisionSource === "connected" && (
              <button
                onClick={() => {
                  setStatusFilter('blocked');
                  setState('idle');
                  setNormalizedTrace(null);
                  setResult(null);
                }}
                className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md transition-colors"
              >
                Load a BLOCKED recent submission
              </button>
            )}
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
          {/* Outcome Badge */}
          <div className="flex items-center gap-3">
            {getOutcomeBadge(normalizedTrace ? normalizedTrace.outcome : result!.debug.outcome)}
            <div className="text-[11px] text-zinc-400">
              {normalizedTrace ? normalizedTrace.decision_summary : result!.answer}
            </div>
          </div>

          {/* Export Decision Packet Buttons - Verifier/Admin only */}
          {canDownloadPackets(role) && (
            <div className="flex items-center gap-2 py-2 border-y border-zinc-800">
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
              <span className="text-[10px] text-zinc-500 ml-auto">
                Audit-ready decision packet
              </span>
            </div>
          )}

          {/* APPROVED OUTCOME: Show Decision Summary + Evaluated Rules */}
          {((normalizedTrace && normalizedTrace.outcome === "approved") || (result && result.debug.outcome === "approved")) && (
            <div className="space-y-3">
              {/* Decision Summary */}
              {(normalizedTrace?.decision_summary || result?.debug.decision_summary) && (
                <div className="rounded-lg bg-green-900/20 border border-green-600/30 px-3 py-2.5">
                  <div className="text-xs font-semibold text-green-400 mb-1.5">
                    ✓ Why This Decision Was Approved
                  </div>
                  <p className="text-[11px] text-green-200/90 leading-relaxed">
                    {normalizedTrace?.decision_summary || result?.debug.decision_summary}
                  </p>
                </div>
              )}

              {/* Satisfied Requirements */}
              {(normalizedTrace?.satisfied_requirements?.length || result?.debug.satisfied_requirements?.length) ? (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2">
                  <div className="text-xs font-semibold text-zinc-200 mb-2">
                    ✓ Checks Passed ({(normalizedTrace?.satisfied_requirements || result?.debug.satisfied_requirements || []).length})
                  </div>
                  <ul className="space-y-1">
                    {(normalizedTrace?.satisfied_requirements || result?.debug.satisfied_requirements || []).map((req, idx) => (
                      <li key={idx} className="text-[11px] text-zinc-400 flex items-start gap-2">
                        <span className="text-green-400 shrink-0">✓</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Evaluated Rules (Passed + Info) */}
              {(normalizedTrace?.evaluated_rules?.length || result?.debug.evaluated_rules?.length) ? (
                <div>
                  <div className="text-xs font-semibold text-zinc-200 mb-2">
                    Rules Evaluated ({(normalizedTrace?.evaluated_rules || result?.debug.evaluated_rules || []).length})
                  </div>
                  <div className="space-y-2">
                    {(normalizedTrace?.evaluated_rules || result?.debug.evaluated_rules || []).map((rule) => (
                      <div
                        key={rule.id}
                        className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2.5 text-[11px]"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-100">{rule.title}</span>
                            {rule.status === "passed" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                                PASSED
                              </span>
                            )}
                            {rule.status === "info" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                INFO
                              </span>
                            )}
                          </div>
                          {rule.citation && (
                            <div className="text-[10px] text-zinc-500 font-mono shrink-0">
                              {rule.citation}
                            </div>
                          )}
                        </div>
                        
                        <div className="text-zinc-50 mb-1 leading-relaxed">{rule.requirement}</div>
                        
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                          <span>{rule.jurisdiction}</span>
                          <span>•</span>
                          <span className="font-mono">{rule.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* BLOCKED or NEEDS_REVIEW OUTCOME: Show Original Layout */}
          {((normalizedTrace && (normalizedTrace.outcome === "blocked" || normalizedTrace.outcome === "needs_review")) || 
            (result && (result.debug.outcome === "blocked" || result.debug.outcome === "needs_review"))) && (
            <div className="space-y-3">
              {/* Missing Evidence */}
              {(normalizedTrace?.missing_evidence?.length || result?.debug.missing_evidence?.length) ? (
                <div className="rounded-lg border border-amber-500/70 bg-amber-900/60 px-4 py-3">
                  <div className="text-sm font-bold text-amber-100 mb-2">
                    Missing Evidence ({(normalizedTrace?.missing_evidence || result?.debug.missing_evidence || []).length})
                  </div>
                  <ul className="space-y-1.5">
                    {(normalizedTrace?.missing_evidence || result?.debug.missing_evidence || []).map((item, idx) => (
                      <li key={idx} className="text-xs text-amber-50 flex items-start gap-2 leading-relaxed">
                        <span className="shrink-0">❗</span>
                        <span>{String(item).replace(/\\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Next Steps */}
              {(normalizedTrace?.next_steps?.length || result?.debug.next_steps?.length) ? (
                <div className="rounded-lg border border-blue-500/70 bg-blue-900/60 px-4 py-3">
                  <div className="text-sm font-bold text-blue-100 mb-2">
                    Next Steps ({(normalizedTrace?.next_steps || result?.debug.next_steps || []).length})
                  </div>
                  <ul className="space-y-1.5">
                    {(normalizedTrace?.next_steps || result?.debug.next_steps || []).map((step, idx) => (
                      <li key={idx} className="text-xs text-blue-50 flex items-start gap-2 leading-relaxed">
                        <span className="shrink-0">→</span>
                        <span>{String(step).replace(/\\n/g, ' ').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Fired Rules by Severity - Verifier/Admin only */}
              {canViewFiredRules(role) && (normalizedTrace?.fired_rules?.length || result?.debug.fired_rules?.length) ? (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-zinc-100">
                    Fired Rules ({(normalizedTrace?.fired_rules || result?.debug.fired_rules || []).length} total)
                  </div>

                  {(() => {
                    const groups = groupRulesBySeverity(normalizedTrace?.fired_rules || result?.debug.fired_rules || []);
                    return (
                      <>
                        {/* BLOCK Rules */}
                        {groups.block.length > 0 && (
                          <div>
                            <div className="text-[11px] font-bold text-red-300 mb-2 flex items-center gap-2">
                              <span>🚫 BLOCK</span>
                              <span className="text-zinc-400">({groups.block.length} rules)</span>
                            </div>
                            <div className="space-y-1.5">
                              {groups.block.map((rule, idx) => renderRule(rule, idx))}
                            </div>
                          </div>
                        )}

                        {/* REVIEW Rules */}
                        {groups.review.length > 0 && (
                          <div>
                            <div className="text-[11px] font-bold text-yellow-300 mb-2 flex items-center gap-2">
                              <span>⚠️ REVIEW</span>
                              <span className="text-zinc-400">({groups.review.length} rules)</span>
                            </div>
                            <div className="space-y-1.5">
                              {groups.review.map((rule, idx) => renderRule(rule, idx))}
                            </div>
                          </div>
                        )}

                        {/* INFO Rules */}
                        {groups.info.length > 0 && (
                          <div>
                            <div className="text-[11px] font-bold text-blue-300 mb-2 flex items-center gap-2">
                              <span>ℹ️ INFO</span>
                              <span className="text-zinc-400">({groups.info.length} rules)</span>
                            </div>
                            <div className="space-y-1.5">
                              {groups.info.map((rule, idx) => renderRule(rule, idx))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          )}
          
          {/* NEW SECTIONS: Completeness, Counterfactuals, Request Info */}
          
          {/* Data Completeness Score */}
          {completenessScore && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-zinc-100">
                  📊 Data Completeness
                </div>
                <div className={`text-2xl font-bold ${
                  completenessScore.scorePct === 100 ? 'text-green-400' :
                  completenessScore.scorePct >= 75 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {completenessScore.scorePct}%
                </div>
              </div>
              
              <div className="text-xs text-zinc-400 mb-3">
                {completenessScore.presentCount} of {completenessScore.totalCount} required fields present
              </div>
              
              {completenessScore.missing.block.length > 0 && (
                <div className="mb-2">
                  <div className="text-[11px] font-semibold text-red-300 mb-1">
                    🚫 Missing BLOCK Fields ({completenessScore.missing.block.length})
                  </div>
                  <ul className="space-y-1">
                    {completenessScore.missing.block.map((field, idx) => (
                      <li key={idx} className="text-[11px] text-red-200/80 flex items-start gap-2">
                        <span className="shrink-0">•</span>
                        <span>{getFieldDisplayName(field)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {completenessScore.missing.review.length > 0 && (
                <div className="mb-2">
                  <div className="text-[11px] font-semibold text-yellow-300 mb-1">
                    ⚠️ Missing REVIEW Fields ({completenessScore.missing.review.length})
                  </div>
                  <ul className="space-y-1">
                    {completenessScore.missing.review.map((field, idx) => (
                      <li key={idx} className="text-[11px] text-yellow-200/80 flex items-start gap-2">
                        <span className="shrink-0">•</span>
                        <span>{getFieldDisplayName(field)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {completenessScore.missing.info.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-blue-300 mb-1">
                    ℹ️ Missing INFO Fields ({completenessScore.missing.info.length})
                  </div>
                  <ul className="space-y-1">
                    {completenessScore.missing.info.map((field, idx) => (
                      <li key={idx} className="text-[11px] text-blue-200/80 flex items-start gap-2">
                        <span className="shrink-0">•</span>
                        <span>{getFieldDisplayName(field)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {completenessScore.scorePct === 100 && (
                <div className="text-[11px] text-green-300 flex items-center gap-2">
                  <span>✓</span>
                  <span>All required data fields are present</span>
                </div>
              )}
            </div>
          )}
          
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
                        completenessScore,
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
