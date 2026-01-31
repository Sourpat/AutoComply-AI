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

export type HumanActionEvent = {
  id: string;
  caseId: string;
  type: "NOTE_ADDED" | "EVIDENCE_REVIEWED" | "OVERRIDE_DECISION" | "EXPORT_JSON" | "EXPORT_PDF";
  actor: "verifier";
  timestamp: string;
  payload: Record<string, unknown>;
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

export function getHumanEvents(caseId: string): HumanActionEvent[] {
  const raw = localStorage.getItem(`agentic:human-events:${caseId}`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as HumanActionEvent[];
  } catch {
    return [];
  }
}

export function appendHumanEvent(caseId: string, event: Omit<HumanActionEvent, "id" | "timestamp">) {
  const existing = getHumanEvents(caseId);
  const nextEvent: HumanActionEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  };
  const updated = [...existing, nextEvent];
  localStorage.setItem(`agentic:human-events:${caseId}`, JSON.stringify(updated));
  return nextEvent;
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
  localStorage.setItem(`agentic:audit-packet:${hash}`, JSON.stringify(packet));
}

export function loadAuditPacket(hash: string): AuditPacket | null {
  const raw = localStorage.getItem(`agentic:audit-packet:${hash}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuditPacket;
  } catch {
    return null;
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
