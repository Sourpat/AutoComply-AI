/**
 * Trace normalization utility
 * 
 * Normalizes decision trace data from different sources (snake_case vs camelCase)
 * into a consistent internal format for rendering in the RAG Explorer.
 */

export interface NormalizedFiredRule {
  id: string;
  title: string;
  severity: string;
  jurisdiction: string;
  citation: string;
  rationale: string;
  requirement: string;
  snippet?: string;
}

export interface NormalizedEvaluatedRule {
  id: string;
  title: string;
  severity: string;
  jurisdiction: string;
  citation: string;
  rationale: string;
  requirement: string;
  status: string; // "passed" | "failed" | "info"
}

export interface NormalizedDriver {
  type: string; // "policy_rule" | "missing_field" | "citation"
  label: string;
  severity?: string;
  details?: string;
}

export interface NormalizedTrace {
  outcome: string; // "approved" | "needs_review" | "blocked"
  status: string; // "ok_to_ship" | "blocked" | "needs_review"
  risk_level: string; // "Low" | "Medium" | "High"
  decision_summary: string;
  fired_rules: NormalizedFiredRule[];
  evaluated_rules: NormalizedEvaluatedRule[];
  drivers: NormalizedDriver[];
  missing_evidence: string[];
  next_steps: string[];
  satisfied_requirements: string[];
  citations: Array<{ text: string; source: string }>;
  evidence: Record<string, any>;
}

/**
 * Normalize a trace/decision payload into consistent format.
 * Handles both snake_case (backend) and camelCase (frontend) field names.
 */
export function normalizeTrace(rawTrace: any): NormalizedTrace {
  if (!rawTrace) {
    return createEmptyTrace();
  }

  // Support nested decision object or flat structure
  const decision = rawTrace.decision || rawTrace;
  const payload = rawTrace.payload || rawTrace;

  // Extract status with fallback chain
  const status = 
    decision.status || 
    decision.decision_status || 
    rawTrace.status || 
    payload.status || 
    "needs_review";

  // Map status to outcome
  const outcome = mapStatusToOutcome(status);

  // Extract risk level
  const risk_level = 
    decision.risk_level || 
    decision.riskLevel || 
    rawTrace.risk || 
    rawTrace.risk_level || 
    "Medium";

  // Extract decision summary
  const decision_summary = 
    decision.decision_summary || 
    decision.decisionSummary || 
    decision.summary || 
    decision.reason ||
    payload.decision_summary ||
    payload.summary ||
    generateDefaultSummary(outcome, risk_level);

  // Extract fired rules (supports both snake_case and camelCase)
  const firedRulesRaw = 
    decision.fired_rules || 
    decision.firedRules || 
    payload.fired_rules || 
    payload.firedRules || 
    [];
  
  const fired_rules = firedRulesRaw.map((rule: any) => normalizeFiredRule(rule));

  // Extract evaluated rules
  const evaluatedRulesRaw = 
    decision.evaluated_rules || 
    decision.evaluatedRules || 
    payload.evaluated_rules || 
    payload.evaluatedRules || 
    [];
  
  const evaluated_rules = evaluatedRulesRaw.map((rule: any) => normalizeEvaluatedRule(rule));

  // Extract missing evidence
  const missing_evidence = 
    decision.missing_evidence || 
    decision.missingEvidence || 
    decision.missing_fields ||
    decision.missingFields ||
    payload.missing_evidence || 
    payload.missing_fields ||
    [];

  // Extract next steps
  const next_steps = 
    decision.next_steps || 
    decision.nextSteps || 
    payload.next_steps || 
    payload.nextSteps ||
    generateDefaultNextSteps(outcome, missing_evidence);

  // Extract satisfied requirements (for approved outcomes)
  const satisfied_requirements = 
    decision.satisfied_requirements || 
    decision.satisfiedRequirements || 
    payload.satisfied_requirements ||
    [];

  // Extract citations/snippets
  const citationsRaw = 
    decision.citations || 
    decision.sources || 
    payload.citations || 
    payload.sources ||
    [];
  
  const citations = citationsRaw.map((cit: any) => ({
    text: cit.text || cit.snippet || cit.content || "",
    source: cit.source || cit.citation || cit.id || ""
  }));

  const driversRaw =
    decision.drivers ||
    payload.drivers ||
    rawTrace.drivers ||
    [];

  const drivers: NormalizedDriver[] = Array.isArray(driversRaw)
    ? driversRaw.map((driver: any) => ({
        type: driver.type || "policy_rule",
        label: driver.label || driver.title || driver.name || "",
        severity: driver.severity || driver.level || undefined,
        details: driver.details || driver.reason || driver.rationale || undefined,
      }))
    : [];

  if (drivers.length === 0 && fired_rules.length > 0) {
    fired_rules.forEach((rule) => {
      drivers.push({
        type: "policy_rule",
        label: rule.title || rule.id,
        severity: rule.severity,
        details: rule.rationale || rule.requirement,
      });
    });
  }

  if (drivers.length === 0 && missing_evidence.length > 0) {
    missing_evidence.forEach((item) => {
      drivers.push({
        type: "missing_field",
        label: item,
        severity: "review",
      });
    });
  }

  // Extract evidence
  const evidence = 
    decision.evidence || 
    payload.evidence || 
    rawTrace.evidence || 
    {};

  return {
    outcome,
    status,
    risk_level,
    decision_summary,
    fired_rules,
    evaluated_rules,
    drivers,
    missing_evidence,
    next_steps,
    satisfied_requirements,
    citations,
    evidence
  };
}

function normalizeFiredRule(rule: any): NormalizedFiredRule {
  return {
    id: rule.id || rule.rule_id || "",
    title: rule.title || rule.name || "",
    severity: rule.severity || "info",
    jurisdiction: rule.jurisdiction || "",
    citation: rule.citation || rule.cite || "",
    rationale: rule.rationale || rule.reason || "",
    requirement: rule.requirement || rule.text || "",
    snippet: rule.snippet || rule.evidence || ""
  };
}

function normalizeEvaluatedRule(rule: any): NormalizedEvaluatedRule {
  return {
    id: rule.id || rule.rule_id || "",
    title: rule.title || rule.name || "",
    severity: rule.severity || "info",
    jurisdiction: rule.jurisdiction || "",
    citation: rule.citation || rule.cite || "",
    rationale: rule.rationale || rule.reason || "",
    requirement: rule.requirement || rule.text || "",
    status: rule.status || "passed"
  };
}

function mapStatusToOutcome(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized.includes("ok") || normalized === "approved") {
    return "approved";
  } else if (normalized.includes("block")) {
    return "blocked";
  } else {
    return "needs_review";
  }
}

function generateDefaultSummary(outcome: string, risk_level: string): string {
  if (outcome === "approved") {
    return "All regulatory requirements have been met. No blocking violations detected.";
  } else if (outcome === "blocked") {
    return `Application blocked due to critical regulatory violations. Risk level: ${risk_level}.`;
  } else {
    return `Application requires manual review. Risk level: ${risk_level}.`;
  }
}

function generateDefaultNextSteps(outcome: string, missing_evidence: string[]): string[] {
  if (outcome === "approved") {
    return ["Submission approved. No further action required."];
  } else if (missing_evidence.length > 0) {
    return missing_evidence.map(field => `Provide: ${field}`);
  } else {
    return ["Review compliance requirements", "Contact support if needed"];
  }
}

function createEmptyTrace(): NormalizedTrace {
  return {
    outcome: "needs_review",
    status: "needs_review",
    risk_level: "Medium",
    decision_summary: "No trace data available",
    fired_rules: [],
    evaluated_rules: [],
    missing_evidence: [],
    next_steps: [],
    satisfied_requirements: [],
    citations: [],
    evidence: {}
  };
}
