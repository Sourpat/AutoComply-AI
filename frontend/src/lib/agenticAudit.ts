import type { WorkQueueSubmission } from "../api/consoleClient";
import type { AgentPlan, CaseEvent } from "../contracts/agentic";

export type EvidenceItem = {
  id: string;
  type: "doc" | "field" | "external_check" | "user_attestation" | "agent_step";
  source: string;
  timestamp: string;
  details: Record<string, unknown> | string;
};

export type EvidenceState = Record<
  string,
  {
    note?: string;
    reviewed?: boolean;
  }
>;

export type AuditPacket = {
  metadata: {
    caseId: string;
    decisionId: string;
    generatedAt: string;
  };
  caseSnapshot: {
    submissionId: string;
    tenant: string;
    formType: string;
    status: string;
    riskLevel: string | null;
    createdAt: string;
    updatedAt: string;
    title: string;
    subtitle?: string;
    summary?: string | null;
    traceId?: string | null;
  };
  decision: {
    status: string;
    confidence: number | null;
    riskLevel: string | null;
    decisionId: string;
    updatedAt: string;
  };
  explainability: {
    summary?: string;
    traceId?: string;
    timestamp?: string;
    rulesEvaluated?: AgentPlan["trace"]["rulesEvaluated"];
    modelNotes?: string[];
  };
  timelineEvents: Array<{
    id: string;
    type: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }>;
  evidenceIndex: Array<{
    id: string;
    type: EvidenceItem["type"];
    source: string;
    timestamp: string;
    details: Record<string, unknown> | string;
    reviewed?: boolean;
    note?: string;
  }>;
  humanActions: {
    auditNotes?: string;
    evidenceNotes: EvidenceState;
  };
};

export function toDecisionId(caseId: string, updatedAt: string) {
  const sanitized = updatedAt.replace(/[-:]/g, "").replace("T", "_").slice(0, 13);
  return `decision_${caseId}_${sanitized}`;
}

export function buildAuditPacket(params: {
  caseItem: WorkQueueSubmission;
  plan: AgentPlan | null;
  events: CaseEvent[];
  evidenceItems: EvidenceItem[];
  evidenceState: EvidenceState;
  auditNotes?: string;
}): AuditPacket {
  const { caseItem, plan, events, evidenceItems, evidenceState, auditNotes } = params;
  const decisionId = toDecisionId(caseItem.submission_id, caseItem.updated_at);

  return {
    metadata: {
      caseId: caseItem.submission_id,
      decisionId,
      generatedAt: new Date().toISOString(),
    },
    caseSnapshot: {
      submissionId: caseItem.submission_id,
      tenant: caseItem.tenant,
      formType: caseItem.csf_type,
      status: caseItem.status,
      riskLevel: caseItem.risk_level ?? null,
      createdAt: caseItem.created_at,
      updatedAt: caseItem.updated_at,
      title: caseItem.title,
      subtitle: caseItem.subtitle,
      summary: caseItem.summary,
      traceId: caseItem.trace_id ?? null,
    },
    decision: {
      status: plan?.status ?? caseItem.decision_status ?? caseItem.status,
      confidence: plan?.confidence ?? null,
      riskLevel: caseItem.risk_level ?? null,
      decisionId,
      updatedAt: caseItem.updated_at,
    },
    explainability: {
      summary: plan?.summary,
      traceId: plan?.trace?.traceId,
      timestamp: plan?.trace?.timestamp,
      rulesEvaluated: plan?.trace?.rulesEvaluated,
      modelNotes: plan?.trace?.modelNotes,
    },
    timelineEvents: events.map((event) => ({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp,
      payload: event.payload,
    })),
    evidenceIndex: evidenceItems.map((item) => ({
      id: item.id,
      type: item.type,
      source: item.source,
      timestamp: item.timestamp,
      details: item.details,
      reviewed: evidenceState[item.id]?.reviewed ?? false,
      note: evidenceState[item.id]?.note ?? "",
    })),
    humanActions: {
      auditNotes,
      evidenceNotes: evidenceState,
    },
  };
}

export function buildAuditFileName(caseId: string, timestamp: Date = new Date()) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const yyyy = timestamp.getFullYear();
  const mm = pad(timestamp.getMonth() + 1);
  const dd = pad(timestamp.getDate());
  const hh = pad(timestamp.getHours());
  const min = pad(timestamp.getMinutes());
  return `autocomply_audit_packet_${caseId}_${yyyy}${mm}${dd}_${hh}${min}.json`;
}
