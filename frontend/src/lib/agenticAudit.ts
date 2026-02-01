import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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

export type SpecRuleMeta = {
  ruleId: string;
  severity: string;
  ruleVersion: number;
};

export type SpecTrace = {
  specId: string;
  specVersionUsed: number;
  latestSpecVersion?: number | null;
  drift?: boolean | null;
  regulationRef?: string | null;
  snippet?: string | null;
  ruleIdsUsed: string[];
  rulesMeta: SpecRuleMeta[];
  parsedConditions: Array<Record<string, unknown>>;
  ruleMappingUsed: Array<Record<string, unknown>>;
  constraintsTriggered: string[];
};

export type HumanActionEvent = {
  id: string;
  caseId: string;
  type: "NOTE_ADDED" | "EVIDENCE_REVIEWED" | "OVERRIDE_DECISION" | "EXPORT_JSON" | "EXPORT_PDF" | "override_feedback";
  actor: "verifier";
  timestamp: string;
  payload: Record<string, unknown>;
  clientEventId?: string;
  source?: "local" | "server";
};

export type AuditPacket = {
  metadata: {
    caseId: string;
    decisionId: string;
    generatedAt: string;
  };
  packetHash?: string;
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
    events: HumanActionEvent[];
  };
  decision_trace?: {
    spec?: SpecTrace;
  };
  execution_preview?: any;
};

export type TraceMeta = {
  status?: string;
  nextState?: string;
  confidence?: number;
  summary?: string;
};

export type TraceGroup = {
  id: string;
  type: string;
  label: string;
  signature: string;
  count: number;
  firstTimestamp: string;
  lastTimestamp: string;
  meta: TraceMeta;
  payload: Record<string, unknown>;
  instances: Array<{
    id: string;
    timestamp: string;
    payload: Record<string, unknown>;
  }>;
};

export function getTraceMeta(event: CaseEvent): TraceMeta {
  const payload = event.payload ?? {};
  return {
    status: typeof payload.status === "string" ? payload.status : undefined,
    nextState: typeof payload.nextState === "string" ? payload.nextState : undefined,
    confidence: typeof payload.confidence === "number" ? payload.confidence : undefined,
    summary: typeof payload.summary === "string" ? payload.summary : undefined,
  };
}

export function getTraceLabel(eventType: string) {
  if (eventType === "agent_plan") return "Plan snapshot";
  return eventType.replace(/_/g, " ");
}

export function buildTraceSignature(event: CaseEvent, meta: TraceMeta) {
  return [
    event.type,
    meta.summary ?? "",
    meta.status ?? "",
    meta.nextState ?? "",
    meta.confidence ?? "",
  ].join("|");
}

export function groupTraceEvents(events: CaseEvent[]): TraceGroup[] {
  const groups: TraceGroup[] = [];
  events.forEach((event) => {
    const meta = getTraceMeta(event);
    const signature = buildTraceSignature(event, meta);
    const label = getTraceLabel(event.type);
    const last = groups[groups.length - 1];
    if (last && last.type === event.type && last.signature === signature) {
      last.count += 1;
      last.lastTimestamp = event.timestamp;
      last.instances.push({ id: event.id, timestamp: event.timestamp, payload: event.payload ?? {} });
      return;
    }
    groups.push({
      id: event.id,
      type: event.type,
      label,
      signature,
      count: 1,
      firstTimestamp: event.timestamp,
      lastTimestamp: event.timestamp,
      meta,
      payload: event.payload ?? {},
      instances: [{ id: event.id, timestamp: event.timestamp, payload: event.payload ?? {} }],
    });
  });
  return groups;
}

export function toDecisionId(caseId: string, updatedAt: string) {
  const sanitized = updatedAt.replace(/[-:]/g, "").replace("T", "_").slice(0, 13);
  return `decision_${caseId}_${sanitized}`;
}

export function getExecutionPreview(packet?: AuditPacket | null) {
  return packet?.execution_preview ?? null;
}

export function buildAuditPacket(params: {
  caseItem: WorkQueueSubmission;
  plan: AgentPlan | null;
  events: CaseEvent[];
  evidenceItems: EvidenceItem[];
  evidenceState: EvidenceState;
  humanEvents: HumanActionEvent[];
  auditNotes?: string;
  packetHash?: string;
}): AuditPacket {
  const { caseItem, plan, events, evidenceItems, evidenceState, auditNotes, humanEvents, packetHash } = params;
  const decisionId = toDecisionId(caseItem.submission_id, caseItem.updated_at);

  return {
    metadata: {
      caseId: caseItem.submission_id,
      decisionId,
      generatedAt: new Date().toISOString(),
    },
    packetHash,
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
      events: humanEvents,
    },
  };
}

export function getHumanEvents(caseId: string) {
  try {
    const raw = localStorage.getItem(`agentic:human-events:${caseId}`);
    if (!raw) return { events: [] as HumanActionEvent[], error: null as string | null };
    return { events: JSON.parse(raw) as HumanActionEvent[], error: null as string | null };
  } catch (error) {
    return {
      events: [] as HumanActionEvent[],
      error: error instanceof Error ? error.message : "Local storage unavailable",
    };
  }
}

export function appendHumanEvent(caseId: string, event: Omit<HumanActionEvent, "id" | "timestamp">) {
  try {
    const existing = getHumanEvents(caseId).events;
    const clientEventId = event.clientEventId ?? crypto.randomUUID();
    const nextEvent: HumanActionEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...event,
      clientEventId,
      source: event.source ?? "local",
    };
    const updated = [...existing, nextEvent];
    localStorage.setItem(`agentic:human-events:${caseId}`, JSON.stringify(updated));
    return { event: nextEvent, error: null as string | null };
  } catch (error) {
    return {
      event: null,
      error: error instanceof Error ? error.message : "Unable to write to local storage",
    };
  }
}

export function stableStringify(input: unknown): string {
  if (input === null || typeof input !== "object") {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((item) => stableStringify(item)).join(",")}]`;
  }

  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`);
  return `{${entries.join(",")}}`;
}

export function canonicalizeForHash(packet: AuditPacket) {
  const { packetHash, ...rest } = packet;
  const { metadata, ...restData } = rest;
  const { generatedAt, ...metadataStable } = metadata;
  return {
    ...restData,
    metadata: metadataStable,
  };
}

export async function computePacketHash(packet: AuditPacket) {
  const canonical = canonicalizeForHash(packet);
  const encoded = new TextEncoder().encode(stableStringify(canonical));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function saveAuditPacket(packet: AuditPacket, hash: string) {
  try {
    localStorage.setItem(`agentic:audit-packet:${hash}`, JSON.stringify(packet));
    return { ok: true, error: null as string | null };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to write to local storage",
    };
  }
}

export function loadAuditPacket(hash: string) {
  try {
    const raw = localStorage.getItem(`agentic:audit-packet:${hash}`);
    if (!raw) return { packet: null as AuditPacket | null, error: null as string | null };
    return { packet: JSON.parse(raw) as AuditPacket, error: null as string | null };
  } catch (error) {
    return {
      packet: null as AuditPacket | null,
      error: error instanceof Error ? error.message : "Local storage unavailable",
    };
  }
}

export async function buildAuditPdf(packet: AuditPacket, hash: string) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 48;
  const lineHeight = 14;

  let page = pdfDoc.addPage(pageSize);
  let y = page.getHeight() - margin;

  const addPage = () => {
    page = pdfDoc.addPage(pageSize);
    y = page.getHeight() - margin;
  };

  const writeLine = (text: string, bold = false, size = 11) => {
    if (y < margin + lineHeight) {
      addPage();
    }
    page.drawText(text, {
      x: margin,
      y,
      size,
      font: bold ? fontBold : font,
      color: rgb(0.15, 0.16, 0.18),
    });
    y -= lineHeight;
  };

  const wrapText = (text: string, size = 11, bold = false) => {
    const words = text.split(" ");
    let line = "";
    const maxWidth = page.getWidth() - margin * 2;
    const activeFont = bold ? fontBold : font;

    words.forEach((word) => {
      const testLine = line ? `${line} ${word}` : word;
      const width = activeFont.widthOfTextAtSize(testLine, size);
      if (width > maxWidth) {
        writeLine(line, bold, size);
        line = word;
      } else {
        line = testLine;
      }
    });
    if (line) writeLine(line, bold, size);
  };

  writeLine("AutoComply AI Audit Packet", true, 16);
  writeLine("");

  writeLine("Case Metadata", true, 12);
  writeLine(`Case ID: ${packet.metadata.caseId}`);
  writeLine(`Decision ID: ${packet.metadata.decisionId}`);
  writeLine(`Status: ${packet.decision.status}`);
  writeLine(`Risk: ${packet.decision.riskLevel ?? "unknown"}`);
  writeLine(`Confidence: ${packet.decision.confidence !== null ? Math.round(packet.decision.confidence * 100) + "%" : "--"}`);
  writeLine(`Created: ${packet.caseSnapshot.createdAt}`);
  writeLine(`Updated: ${packet.caseSnapshot.updatedAt}`);
  writeLine("");

  writeLine("Decision Summary", true, 12);
  wrapText(packet.explainability.summary ?? "No summary available.");
  writeLine("");

  writeLine("Decision Trace (Top 20)", true, 12);
  const traceItems = packet.timelineEvents.slice(0, 20);
  if (traceItems.length === 0) {
    writeLine("No timeline events recorded.");
  } else {
    traceItems.forEach((event) => {
      wrapText(`${event.timestamp} • ${event.type}`, 10, true);
      wrapText(JSON.stringify(event.payload), 9, false);
    });
  }
  if (packet.timelineEvents.length > 20) {
    writeLine(`(${packet.timelineEvents.length - 20} more events truncated)`);
  }
  writeLine("");

  writeLine("Evidence Index", true, 12);
  if (packet.evidenceIndex.length === 0) {
    writeLine("No evidence captured.");
  } else {
    packet.evidenceIndex.forEach((item) => {
      wrapText(`${item.timestamp} • ${item.type} • ${item.source}`, 10, true);
    });
  }
  writeLine("");

  writeLine("Human Actions", true, 12);
  if (packet.humanActions.auditNotes) {
    wrapText(`Verifier Notes: ${packet.humanActions.auditNotes}`, 10);
  }
  if (packet.humanActions.events.length === 0) {
    writeLine("No human actions recorded.");
  } else {
    packet.humanActions.events.forEach((event) => {
      wrapText(`${event.timestamp} • ${event.type}`, 10, true);
      wrapText(JSON.stringify(event.payload), 9, false);
    });
  }

  writeLine("");
  writeLine(`Packet Hash (SHA-256): ${hash}`, false, 9);

  return pdfDoc.save();
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
