import type { AuditPacket } from "./agenticAudit";
import { stableStringify } from "./agenticAudit";

export type AuditDiffMeta = {
  packetHash: string;
  caseId: string;
  decisionId: string;
  createdAt: string;
};

export type DecisionChange = {
  field: string;
  left: unknown;
  right: unknown;
};

export type EvidencePreview = {
  id?: string;
  signature: string;
  type?: string;
  source?: string;
  timestamp?: string;
  title?: string;
};

export type EvidenceChange = {
  left: EvidencePreview;
  right: EvidencePreview;
};

export type HumanActionPreview = {
  id?: string;
  signature: string;
  type?: string;
  timestamp?: string;
  actor?: string;
  payloadKeys: string[];
};

export type AuditDiff = {
  left: AuditDiffMeta;
  right: AuditDiffMeta;
  summary: {
    hasChanges: boolean;
    decisionChanges: number;
    evidenceChanges: number;
    humanActionChanges: number;
    timelineAddedTypes: number;
  };
  changes: {
    decision: DecisionChange[];
    evidence: {
      added: EvidencePreview[];
      removed: EvidencePreview[];
      changed: EvidenceChange[];
    };
    humanActions: {
      added: HumanActionPreview[];
      removed: HumanActionPreview[];
    };
    timeline: {
      addedTypes: string[];
      counts: {
        left: number;
        right: number;
      };
    };
  };
};

function getEvidenceTitle(details: unknown) {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const record = details as Record<string, unknown>;
    const title = record.title ?? record.name ?? record.label;
    return typeof title === "string" ? title : "";
  }
  return "";
}

function buildEvidenceSignature(item: Record<string, unknown>) {
  const id = item.id;
  if (typeof id === "string" && id) return `id:${id}`;
  const title = getEvidenceTitle(item.details);
  return `sig:${String(item.type ?? "")}||${String(item.source ?? "")}||${String(item.timestamp ?? "")}||${title}`;
}

function buildEvidencePreview(item: Record<string, unknown>): EvidencePreview {
  return {
    id: typeof item.id === "string" ? item.id : undefined,
    signature: buildEvidenceSignature(item),
    type: typeof item.type === "string" ? item.type : undefined,
    source: typeof item.source === "string" ? item.source : undefined,
    timestamp: typeof item.timestamp === "string" ? item.timestamp : undefined,
    title: getEvidenceTitle(item.details),
  };
}

function buildHumanSignature(event: Record<string, unknown>) {
  const id = event.id;
  if (typeof id === "string" && id) return `id:${id}`;
  const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? (event.payload as Record<string, unknown>)
    : {};
  const keys = Object.keys(payload).sort().join(",");
  return `sig:${String(event.type ?? "")}||${String(event.timestamp ?? "")}||${keys}`;
}

function buildHumanPreview(event: Record<string, unknown>): HumanActionPreview {
  const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? (event.payload as Record<string, unknown>)
    : {};
  return {
    id: typeof event.id === "string" ? event.id : undefined,
    signature: buildHumanSignature(event),
    type: typeof event.type === "string" ? event.type : undefined,
    timestamp: typeof event.timestamp === "string" ? event.timestamp : undefined,
    actor: typeof event.actor === "string" ? event.actor : undefined,
    payloadKeys: Object.keys(payload).sort(),
  };
}

function deriveMeta(packet: AuditPacket, override?: Partial<AuditDiffMeta>): AuditDiffMeta {
  return {
    packetHash: override?.packetHash ?? packet.packetHash ?? "",
    caseId: override?.caseId ?? packet.metadata.caseId,
    decisionId: override?.decisionId ?? packet.metadata.decisionId,
    createdAt: override?.createdAt ?? packet.metadata.generatedAt,
  };
}

function buildDecisionChanges(left: AuditPacket, right: AuditPacket): DecisionChange[] {
  const fields: Array<keyof AuditPacket["decision"]> = ["status", "riskLevel", "confidence"];
  return fields
    .map((field) => ({
      field,
      left: left.decision?.[field],
      right: right.decision?.[field],
    }))
    .filter((change) => change.left !== change.right);
}

export function buildAuditDiff(
  leftPacket: AuditPacket,
  rightPacket: AuditPacket,
  options?: { leftMeta?: Partial<AuditDiffMeta>; rightMeta?: Partial<AuditDiffMeta> }
): AuditDiff {
  const leftMeta = deriveMeta(leftPacket, options?.leftMeta);
  const rightMeta = deriveMeta(rightPacket, options?.rightMeta);

  const leftEvidence = leftPacket.evidenceIndex ?? [];
  const rightEvidence = rightPacket.evidenceIndex ?? [];
  const leftEvidenceMap = new Map(leftEvidence.map((item) => {
    const preview = buildEvidencePreview(item as Record<string, unknown>);
    return [preview.signature, preview] as const;
  }));
  const rightEvidenceMap = new Map(rightEvidence.map((item) => {
    const preview = buildEvidencePreview(item as Record<string, unknown>);
    return [preview.signature, preview] as const;
  }));

  const evidenceAdded = Array.from(rightEvidenceMap.entries())
    .filter(([signature]) => !leftEvidenceMap.has(signature))
    .map(([, preview]) => preview);
  const evidenceRemoved = Array.from(leftEvidenceMap.entries())
    .filter(([signature]) => !rightEvidenceMap.has(signature))
    .map(([, preview]) => preview);
  const evidenceChanged: EvidenceChange[] = [];
  Array.from(leftEvidenceMap.entries()).forEach(([signature, leftPreview]) => {
    const rightPreview = rightEvidenceMap.get(signature);
    if (!rightPreview) return;
    if (
      leftPreview.type !== rightPreview.type ||
      leftPreview.source !== rightPreview.source ||
      leftPreview.timestamp !== rightPreview.timestamp ||
      leftPreview.title !== rightPreview.title
    ) {
      evidenceChanged.push({ left: leftPreview, right: rightPreview });
    }
  });

  const leftActions = leftPacket.humanActions?.events ?? [];
  const rightActions = rightPacket.humanActions?.events ?? [];
  const leftActionsMap = new Map(leftActions.map((event) => {
    const preview = buildHumanPreview(event as Record<string, unknown>);
    return [preview.signature, preview] as const;
  }));
  const rightActionsMap = new Map(rightActions.map((event) => {
    const preview = buildHumanPreview(event as Record<string, unknown>);
    return [preview.signature, preview] as const;
  }));

  const humanAdded = Array.from(rightActionsMap.entries())
    .filter(([signature]) => !leftActionsMap.has(signature))
    .map(([, preview]) => preview);
  const humanRemoved = Array.from(leftActionsMap.entries())
    .filter(([signature]) => !rightActionsMap.has(signature))
    .map(([, preview]) => preview);

  const leftTimeline = leftPacket.timelineEvents ?? [];
  const rightTimeline = rightPacket.timelineEvents ?? [];
  const leftTypes = new Set(leftTimeline.map((event) => event.type));
  const rightTypes = new Set(rightTimeline.map((event) => event.type));
  const addedTypes = Array.from(rightTypes).filter((value) => !leftTypes.has(value)).sort();

  const decisionChanges = buildDecisionChanges(leftPacket, rightPacket);
  const hasChanges = Boolean(
    decisionChanges.length ||
      evidenceAdded.length ||
      evidenceRemoved.length ||
      evidenceChanged.length ||
      humanAdded.length ||
      humanRemoved.length ||
      addedTypes.length ||
      leftTimeline.length !== rightTimeline.length
  );

  return {
    left: leftMeta,
    right: rightMeta,
    summary: {
      hasChanges,
      decisionChanges: decisionChanges.length,
      evidenceChanges: evidenceAdded.length + evidenceRemoved.length + evidenceChanged.length,
      humanActionChanges: humanAdded.length + humanRemoved.length,
      timelineAddedTypes: addedTypes.length,
    },
    changes: {
      decision: decisionChanges,
      evidence: {
        added: evidenceAdded,
        removed: evidenceRemoved,
        changed: evidenceChanged,
      },
      humanActions: {
        added: humanAdded,
        removed: humanRemoved,
      },
      timeline: {
        addedTypes,
        counts: { left: leftTimeline.length, right: rightTimeline.length },
      },
    },
  };
}

export function canonicalizeAuditDiff(diff: AuditDiff) {
  const copy = JSON.parse(JSON.stringify(diff)) as Record<string, unknown>;
  delete copy.exportedAt;
  delete copy.diffHash;
  return copy;
}

export async function computeAuditDiffHash(diff: AuditDiff) {
  const canonical = canonicalizeAuditDiff(diff);
  const encoded = new TextEncoder().encode(stableStringify(canonical));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
