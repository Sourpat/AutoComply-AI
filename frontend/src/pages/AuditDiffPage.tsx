import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { CheckCircle2, ChevronDown } from "../lib/lucide-react";
import { formatTimestamp } from "../lib/formatters";
import { loadAuditPacket, type AuditPacket } from "../lib/agenticAudit";
import { fetchAuditPacketFromServer, fetchAuditPacketMeta } from "../lib/auditServer";
import { buildAuditDiff, computeAuditDiffHash, type AuditDiff, type AuditDiffMeta } from "../lib/auditDiff";

const hashPattern = /^[a-f0-9]{64}$/i;
const MAX_PREVIEW_ITEMS = 5;

type PacketLoadResult = {
  packet: AuditPacket | null;
  meta: Partial<AuditDiffMeta> | null;
  error: string | null;
};

type SameHashInfo = AuditDiffMeta & { comparedAt: string };

type EvidenceTab = "added" | "removed" | "changed";

type SectionKey =
  | "decision"
  | "evidence-added"
  | "evidence-removed"
  | "evidence-changed"
  | "human-added"
  | "human-removed"
  | "timeline";

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "--";
  if (typeof value === "number") return value.toFixed(2);
  return String(value);
}

function formatFileTimestamp(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(
    date.getHours()
  )}${pad(date.getMinutes())}`;
}

function NoChangesRow({ label = "No changes" }: { label?: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
      {label}
    </div>
  );
}

function SectionToggle({
  expanded,
  total,
  onToggle,
}: {
  expanded: boolean;
  total: number;
  onToggle: () => void;
}) {
  if (total <= MAX_PREVIEW_ITEMS) return null;
  return (
    <Button variant="ghost" size="sm" onClick={onToggle} className="gap-1 text-xs">
      {expanded ? "Show less" : `Show all (${total})`}
      <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </Button>
  );
}

export function AuditDiffPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [leftHash, setLeftHash] = useState("");
  const [rightHash, setRightHash] = useState("");
  const [diff, setDiff] = useState<AuditDiff | null>(null);
  const [sameHashInfo, setSameHashInfo] = useState<SameHashInfo | null>(null);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [evidenceTab, setEvidenceTab] = useState<EvidenceTab>("added");
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    "decision": false,
    "evidence-added": false,
    "evidence-removed": false,
    "evidence-changed": false,
    "human-added": false,
    "human-removed": false,
    "timeline": false,
  });
  const initializedRef = useRef(false);

  const copyValue = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  const loadPacket = useCallback(async (hash: string, sideLabel: "left" | "right"): Promise<PacketLoadResult> => {
    if (!hash.trim()) {
      return { packet: null, meta: null, error: `${sideLabel} hash is required` };
    }
    if (!hashPattern.test(hash.trim())) {
      return { packet: null, meta: null, error: `${sideLabel} hash is invalid` };
    }

    const serverResult = await fetchAuditPacketFromServer(hash.trim());
    if (serverResult.ok) {
      const metaResult = await fetchAuditPacketMeta(hash.trim());
      return {
        packet: serverResult.data,
        meta: metaResult.ok ? (metaResult.data as Partial<AuditDiffMeta>) : null,
        error: null,
      };
    }

    const localResult = loadAuditPacket(hash.trim());
    if (localResult.packet) {
      return { packet: localResult.packet, meta: null, error: null };
    }

    const message = localResult.error || serverResult.message || "Packet not found";
    return { packet: null, meta: null, error: message };
  }, []);

  const runComparison = useCallback(
    async (leftValue: string, rightValue: string) => {
      const left = leftValue.trim();
      const right = rightValue.trim();
      setLoading(true);
      setLeftError(null);
      setRightError(null);
      setDiff(null);
      setSameHashInfo(null);

      if (left && right) {
        setSearchParams({ left, right }, { replace: true });
      }

      if (left && right && left === right) {
        const leftResult = await loadPacket(left, "left");
        if (leftResult.error) {
          setLeftError(leftResult.error);
          setRightError(leftResult.error);
          setLoading(false);
          return;
        }
        if (leftResult.packet) {
          const meta = leftResult.meta;
          setSameHashInfo({
            packetHash: meta?.packetHash ?? leftResult.packet.packetHash ?? left,
            caseId: meta?.caseId ?? leftResult.packet.metadata.caseId,
            decisionId: meta?.decisionId ?? leftResult.packet.metadata.decisionId,
            createdAt: meta?.createdAt ?? leftResult.packet.metadata.generatedAt,
            comparedAt: new Date().toISOString(),
          });
        }
        setLoading(false);
        return;
      }

      const [leftResult, rightResult] = await Promise.all([
        loadPacket(left, "left"),
        loadPacket(right, "right"),
      ]);

      if (leftResult.error) setLeftError(leftResult.error);
      if (rightResult.error) setRightError(rightResult.error);

      if (leftResult.packet && rightResult.packet) {
        const built = buildAuditDiff(leftResult.packet, rightResult.packet, {
          leftMeta: leftResult.meta ?? undefined,
          rightMeta: rightResult.meta ?? undefined,
        });
        setDiff(built);
      }

      setLoading(false);
    },
    [loadPacket, setSearchParams]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    const leftParam = searchParams.get("left") ?? "";
    const rightParam = searchParams.get("right") ?? "";
    if (leftParam) setLeftHash(leftParam);
    if (rightParam) setRightHash(rightParam);
    if (leftParam && rightParam) {
      runComparison(leftParam, rightParam);
    }
    initializedRef.current = true;
  }, [searchParams, runComparison]);

  const handleCompare = async () => {
    await runComparison(leftHash, rightHash);
  };

  const handleExport = async () => {
    if (!diff) return;
    const comparedAt = new Date().toISOString();
    const diffHash = await computeAuditDiffHash(diff);
    const payload = {
      metadata: {
        comparedAt,
        leftHash: diff.left.packetHash,
        rightHash: diff.right.packetHash,
        diffHash,
      },
      diff,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = formatFileTimestamp(new Date());
    anchor.href = url;
    anchor.download = `autocomply_audit_diff_${diff.left.caseId}_${timestamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isExpanded = (key: SectionKey) => Boolean(expandedSections[key]);

  const visibleItems = <T,>(items: T[], key: SectionKey) =>
    isExpanded(key) ? items : items.slice(0, MAX_PREVIEW_ITEMS);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Diff"
        subtitle="Compare two audit packets to understand what changed between decisions."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Left packet hash
              </label>
              <Input
                value={leftHash}
                onChange={(event) => setLeftHash(event.target.value.trim())}
                placeholder="Left packet hash"
              />
              {leftError && <p className="text-xs text-destructive">{leftError}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Right packet hash
              </label>
              <Input
                value={rightHash}
                onChange={(event) => setRightHash(event.target.value.trim())}
                placeholder="Right packet hash"
              />
              {rightError && <p className="text-xs text-destructive">{rightError}</p>}
            </div>
            <Button onClick={handleCompare} disabled={loading}>
              {loading ? "Comparing..." : "Compare"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!diff && !sameHashInfo && !loading && (
            <EmptyState
              title="Compare audit packets"
              description="Enter two packet hashes to generate an audit-grade diff report."
            />
          )}

          {sameHashInfo && (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <div>
                    <h3 className="text-base font-semibold text-foreground">No changes detected</h3>
                    <p className="text-xs text-muted-foreground">
                      Left and right hashes match. This packet is identical across both comparisons.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 text-xs md:grid-cols-3">
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-muted-foreground">Packet hash</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="break-all text-foreground">{sameHashInfo.packetHash}</p>
                      <Button variant="ghost" size="sm" onClick={() => copyValue(sameHashInfo.packetHash)}>
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-muted-foreground">Decision ID</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="break-all text-foreground">{sameHashInfo.decisionId}</p>
                      <Button variant="ghost" size="sm" onClick={() => copyValue(sameHashInfo.decisionId)}>
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                    <p className="text-muted-foreground">Generated</p>
                    <p className="mt-1 text-foreground">{formatTimestamp(sameHashInfo.createdAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {diff && (
            <>
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Left vs Right</h3>
                      <p className="text-xs text-muted-foreground">
                        Decision diff for {diff.left.caseId}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={diff.summary.hasChanges ? "warning" : "success"}>
                        {diff.summary.hasChanges ? "Changes detected" : "No changes"}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={handleExport}>
                        Export Diff JSON
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant={diff.changes.decision.length ? "warning" : "secondary"}>
                      Decision changes {diff.changes.decision.length}
                    </Badge>
                    <Badge variant={diff.changes.evidence.added.length ? "success" : "secondary"}>
                      Evidence added {diff.changes.evidence.added.length}
                    </Badge>
                    <Badge variant={diff.changes.evidence.removed.length ? "destructive" : "secondary"}>
                      Evidence removed {diff.changes.evidence.removed.length}
                    </Badge>
                    <Badge variant={diff.changes.evidence.changed.length ? "warning" : "secondary"}>
                      Evidence changed {diff.changes.evidence.changed.length}
                    </Badge>
                    <Badge variant={diff.changes.humanActions.added.length ? "success" : "secondary"}>
                      Human actions added {diff.changes.humanActions.added.length}
                    </Badge>
                    <Badge variant={diff.changes.timeline.addedTypes.length ? "warning" : "secondary"}>
                      Timeline changes {diff.changes.timeline.addedTypes.length}
                    </Badge>
                  </div>

                  <div className="grid gap-3 text-xs md:grid-cols-2">
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">Left</p>
                        <Button variant="ghost" size="sm" onClick={() => copyValue(diff.left.packetHash)}>
                          Copy hash
                        </Button>
                      </div>
                      <p className="text-muted-foreground break-all">{diff.left.packetHash}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-muted-foreground">Decision {diff.left.decisionId}</p>
                        <Button variant="ghost" size="sm" onClick={() => copyValue(diff.left.decisionId)}>
                          Copy ID
                        </Button>
                      </div>
                      <p className="text-muted-foreground">Created {formatTimestamp(diff.left.createdAt)}</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-foreground">Right</p>
                        <Button variant="ghost" size="sm" onClick={() => copyValue(diff.right.packetHash)}>
                          Copy hash
                        </Button>
                      </div>
                      <p className="text-muted-foreground break-all">{diff.right.packetHash}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-muted-foreground">Decision {diff.right.decisionId}</p>
                        <Button variant="ghost" size="sm" onClick={() => copyValue(diff.right.decisionId)}>
                          Copy ID
                        </Button>
                      </div>
                      <p className="text-muted-foreground">Created {formatTimestamp(diff.right.createdAt)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">Decision changes</CardTitle>
                      <Badge variant={diff.changes.decision.length ? "warning" : "secondary"}>
                        {diff.changes.decision.length}
                      </Badge>
                    </div>
                    <SectionToggle
                      expanded={isExpanded("decision")}
                      total={diff.changes.decision.length}
                      onToggle={() => toggleSection("decision")}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Left</th>
                        <th>Right</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems(diff.changes.decision, "decision").map((change) => (
                        <tr key={change.field}>
                          <td>{change.field}</td>
                          <td>{formatValue(change.left)}</td>
                          <td>{formatValue(change.right)}</td>
                        </tr>
                      ))}
                      {diff.changes.decision.length === 0 && (
                        <tr>
                          <td colSpan={3}>
                            <NoChangesRow label="No decision changes" />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">Evidence changes</CardTitle>
                      <Badge variant={diff.summary.evidenceChanges ? "warning" : "secondary"}>
                        {diff.summary.evidenceChanges}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <Tabs value={evidenceTab} onValueChange={(value) => setEvidenceTab(value as EvidenceTab)}>
                    <TabsList>
                      <TabsTrigger value="added">
                        <span className="flex items-center gap-2">
                          Added
                          <Badge variant={diff.changes.evidence.added.length ? "success" : "secondary"}>
                            {diff.changes.evidence.added.length}
                          </Badge>
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="removed">
                        <span className="flex items-center gap-2">
                          Removed
                          <Badge variant={diff.changes.evidence.removed.length ? "destructive" : "secondary"}>
                            {diff.changes.evidence.removed.length}
                          </Badge>
                        </span>
                      </TabsTrigger>
                      <TabsTrigger value="changed">
                        <span className="flex items-center gap-2">
                          Changed
                          <Badge variant={diff.changes.evidence.changed.length ? "warning" : "secondary"}>
                            {diff.changes.evidence.changed.length}
                          </Badge>
                        </span>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="added">
                      <div className="space-y-2">
                        <ul className="space-y-2 text-xs">
                          {visibleItems(diff.changes.evidence.added, "evidence-added").map((item) => (
                            <li key={item.signature} className="rounded-md border border-border/70 bg-background p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="success">Added</Badge>
                                  <p className="font-semibold text-foreground">{item.type ?? "Evidence"}</p>
                                </div>
                                {item.title && (
                                  <Badge variant="secondary" className="max-w-[180px] truncate">
                                    {item.title}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground">{item.source ?? "--"}</p>
                              <p className="text-muted-foreground">{formatTimestamp(item.timestamp ?? "")}</p>
                            </li>
                          ))}
                        </ul>
                        {diff.changes.evidence.added.length === 0 && <NoChangesRow label="No evidence added" />}
                        <SectionToggle
                          expanded={isExpanded("evidence-added")}
                          total={diff.changes.evidence.added.length}
                          onToggle={() => toggleSection("evidence-added")}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="removed">
                      <div className="space-y-2">
                        <ul className="space-y-2 text-xs">
                          {visibleItems(diff.changes.evidence.removed, "evidence-removed").map((item) => (
                            <li key={item.signature} className="rounded-md border border-border/70 bg-background p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="destructive">Removed</Badge>
                                  <p className="font-semibold text-foreground">{item.type ?? "Evidence"}</p>
                                </div>
                                {item.title && (
                                  <Badge variant="secondary" className="max-w-[180px] truncate">
                                    {item.title}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground">{item.source ?? "--"}</p>
                              <p className="text-muted-foreground">{formatTimestamp(item.timestamp ?? "")}</p>
                            </li>
                          ))}
                        </ul>
                        {diff.changes.evidence.removed.length === 0 && <NoChangesRow label="No evidence removed" />}
                        <SectionToggle
                          expanded={isExpanded("evidence-removed")}
                          total={diff.changes.evidence.removed.length}
                          onToggle={() => toggleSection("evidence-removed")}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="changed">
                      <div className="space-y-2">
                        <ul className="space-y-2 text-xs">
                          {visibleItems(diff.changes.evidence.changed, "evidence-changed").map((item) => (
                            <li key={item.left.signature} className="rounded-md border border-border/70 bg-background p-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="warning">Changed</Badge>
                                <p className="font-semibold text-foreground">{item.left.type ?? "Evidence"}</p>
                              </div>
                              <p className="text-muted-foreground">
                                {item.left.source ?? "--"} → {item.right.source ?? "--"}
                              </p>
                              <p className="text-muted-foreground">
                                {formatTimestamp(item.left.timestamp ?? "")} → {formatTimestamp(item.right.timestamp ?? "")}
                              </p>
                            </li>
                          ))}
                        </ul>
                        {diff.changes.evidence.changed.length === 0 && (
                          <NoChangesRow label="No evidence changes" />
                        )}
                        <SectionToggle
                          expanded={isExpanded("evidence-changed")}
                          total={diff.changes.evidence.changed.length}
                          onToggle={() => toggleSection("evidence-changed")}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">Human actions</CardTitle>
                      <Badge variant={diff.changes.humanActions.added.length ? "success" : "secondary"}>
                        Added {diff.changes.humanActions.added.length}
                      </Badge>
                      <Badge variant={diff.changes.humanActions.removed.length ? "destructive" : "secondary"}>
                        Removed {diff.changes.humanActions.removed.length}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Added</p>
                      <ul className="mt-2 space-y-2 text-xs">
                        {visibleItems(diff.changes.humanActions.added, "human-added").map((event) => (
                          <li key={event.signature} className="rounded-md border border-border/70 bg-background p-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="success">Added</Badge>
                              <p className="font-semibold text-foreground">{event.type}</p>
                            </div>
                            <p className="text-muted-foreground">{formatTimestamp(event.timestamp ?? "")}</p>
                          </li>
                        ))}
                      </ul>
                      {diff.changes.humanActions.added.length === 0 && <NoChangesRow label="No actions added" />}
                      <SectionToggle
                        expanded={isExpanded("human-added")}
                        total={diff.changes.humanActions.added.length}
                        onToggle={() => toggleSection("human-added")}
                      />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Removed</p>
                      <ul className="mt-2 space-y-2 text-xs">
                        {visibleItems(diff.changes.humanActions.removed, "human-removed").map((event) => (
                          <li key={event.signature} className="rounded-md border border-border/70 bg-background p-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">Removed</Badge>
                              <p className="font-semibold text-foreground">{event.type}</p>
                            </div>
                            <p className="text-muted-foreground">{formatTimestamp(event.timestamp ?? "")}</p>
                          </li>
                        ))}
                      </ul>
                      {diff.changes.humanActions.removed.length === 0 && <NoChangesRow label="No actions removed" />}
                      <SectionToggle
                        expanded={isExpanded("human-removed")}
                        total={diff.changes.humanActions.removed.length}
                        onToggle={() => toggleSection("human-removed")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-sm">Timeline summary</CardTitle>
                      <Badge variant={diff.changes.timeline.addedTypes.length ? "warning" : "secondary"}>
                        Added types {diff.changes.timeline.addedTypes.length}
                      </Badge>
                    </div>
                    <SectionToggle
                      expanded={isExpanded("timeline")}
                      total={diff.changes.timeline.addedTypes.length}
                      onToggle={() => toggleSection("timeline")}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0 text-xs">
                  <p className="text-muted-foreground">
                    Left events: {diff.changes.timeline.counts.left} · Right events: {diff.changes.timeline.counts.right}
                  </p>
                  {diff.changes.timeline.addedTypes.length === 0 ? (
                    <NoChangesRow label="No new event types" />
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {visibleItems(diff.changes.timeline.addedTypes, "timeline").map((value) => (
                        <li key={value}>
                          <Badge variant="secondary">{value.replace(/_/g, " ")}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
