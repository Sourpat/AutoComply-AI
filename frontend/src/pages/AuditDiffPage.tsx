import React, { useState } from "react";

import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { loadAuditPacket, type AuditPacket } from "../lib/agenticAudit";
import { fetchAuditPacketFromServer, fetchAuditPacketMeta } from "../lib/auditServer";
import { buildAuditDiff, computeAuditDiffHash, type AuditDiff, type AuditDiffMeta } from "../lib/auditDiff";
import { formatTimestamp } from "../lib/formatters";

const hashPattern = /^[a-f0-9]{64}$/i;

type PacketLoadResult = {
  packet: AuditPacket | null;
  meta: Partial<AuditDiffMeta> | null;
  error: string | null;
};

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "--";
  if (typeof value === "number") return value.toFixed(2);
  return String(value);
}

export function AuditDiffPage() {
  const [leftHash, setLeftHash] = useState("");
  const [rightHash, setRightHash] = useState("");
  const [diff, setDiff] = useState<AuditDiff | null>(null);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [rightError, setRightError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const copyValue = async (value: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  };

  const loadPacket = async (hash: string, sideLabel: "left" | "right"): Promise<PacketLoadResult> => {
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
  };

  const handleCompare = async () => {
    setLoading(true);
    setLeftError(null);
    setRightError(null);
    setDiff(null);

    const [leftResult, rightResult] = await Promise.all([
      loadPacket(leftHash, "left"),
      loadPacket(rightHash, "right"),
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
  };

  const handleExport = async () => {
    if (!diff) return;
    const exportedAt = new Date().toISOString();
    const diffWithExport = { ...diff, exportedAt };
    const diffHash = await computeAuditDiffHash(diffWithExport);
    const payload = { ...diffWithExport, diffHash };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-diff_${diff.left.packetHash.slice(0, 8)}_${diff.right.packetHash.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

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
          {!diff && !loading && (
            <EmptyState
              title="Compare audit packets"
              description="Enter two packet hashes to generate an audit-grade diff report."
            />
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
                <CardContent className="space-y-3 p-5">
                  <h3 className="text-sm font-semibold text-foreground">Decision changes</h3>
                  {diff.changes.decision.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No decision changes detected.</p>
                  ) : (
                    <table className="table-premium">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Left</th>
                          <th>Right</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.changes.decision.map((change) => (
                          <tr key={change.field}>
                            <td>{change.field}</td>
                            <td>{formatValue(change.left)}</td>
                            <td>{formatValue(change.right)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-4 p-5">
                  <h3 className="text-sm font-semibold text-foreground">Evidence changes</h3>
                  <Tabs defaultValue="added">
                    <TabsList>
                      <TabsTrigger value="added">Added ({diff.changes.evidence.added.length})</TabsTrigger>
                      <TabsTrigger value="removed">Removed ({diff.changes.evidence.removed.length})</TabsTrigger>
                      <TabsTrigger value="changed">Changed ({diff.changes.evidence.changed.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="added" className="space-y-2">
                      {diff.changes.evidence.added.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No evidence added.</p>
                      ) : (
                        <ul className="space-y-2 text-xs">
                          {diff.changes.evidence.added.map((item) => (
                            <li key={item.signature} className="rounded-md border border-border/70 bg-background p-2">
                              <p className="font-semibold text-foreground">{item.type}</p>
                              <p className="text-muted-foreground">{item.source}</p>
                              <p className="text-muted-foreground">{formatTimestamp(item.timestamp ?? "")}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TabsContent>
                    <TabsContent value="removed" className="space-y-2">
                      {diff.changes.evidence.removed.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No evidence removed.</p>
                      ) : (
                        <ul className="space-y-2 text-xs">
                          {diff.changes.evidence.removed.map((item) => (
                            <li key={item.signature} className="rounded-md border border-border/70 bg-background p-2">
                              <p className="font-semibold text-foreground">{item.type}</p>
                              <p className="text-muted-foreground">{item.source}</p>
                              <p className="text-muted-foreground">{formatTimestamp(item.timestamp ?? "")}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TabsContent>
                    <TabsContent value="changed" className="space-y-2">
                      {diff.changes.evidence.changed.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No evidence changes detected.</p>
                      ) : (
                        <ul className="space-y-2 text-xs">
                          {diff.changes.evidence.changed.map((item) => (
                            <li key={item.left.signature} className="rounded-md border border-border/70 bg-background p-2">
                              <p className="font-semibold text-foreground">{item.left.type}</p>
                              <p className="text-muted-foreground">{item.left.source} → {item.right.source}</p>
                              <p className="text-muted-foreground">
                                {formatTimestamp(item.left.timestamp ?? "")} → {formatTimestamp(item.right.timestamp ?? "")}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-5">
                  <h3 className="text-sm font-semibold text-foreground">Human actions</h3>
                  {diff.changes.humanActions.added.length === 0 && diff.changes.humanActions.removed.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No human action changes.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Added</p>
                        <ul className="mt-2 space-y-2 text-xs">
                          {diff.changes.humanActions.added.map((event) => (
                            <li key={event.signature} className="rounded-md border border-border/70 bg-background p-2">
                              <p className="font-semibold text-foreground">{event.type}</p>
                              <p className="text-muted-foreground">{formatTimestamp(event.timestamp ?? "")}</p>
                            </li>
                          ))}
                          {diff.changes.humanActions.added.length === 0 && (
                            <p className="text-xs text-muted-foreground">None</p>
                          )}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Removed</p>
                        <ul className="mt-2 space-y-2 text-xs">
                          {diff.changes.humanActions.removed.map((event) => (
                            <li key={event.signature} className="rounded-md border border-border/70 bg-background p-2">
                              <p className="font-semibold text-foreground">{event.type}</p>
                              <p className="text-muted-foreground">{formatTimestamp(event.timestamp ?? "")}</p>
                            </li>
                          ))}
                          {diff.changes.humanActions.removed.length === 0 && (
                            <p className="text-xs text-muted-foreground">None</p>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-2 p-5 text-xs">
                  <h3 className="text-sm font-semibold text-foreground">Timeline summary</h3>
                  <p className="text-muted-foreground">
                    Left events: {diff.changes.timeline.counts.left} · Right events: {diff.changes.timeline.counts.right}
                  </p>
                  {diff.changes.timeline.addedTypes.length === 0 ? (
                    <p className="text-muted-foreground">No new event types.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {diff.changes.timeline.addedTypes.map((value) => (
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
