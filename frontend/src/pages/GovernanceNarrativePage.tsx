import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { ExecutionPreviewPanel } from "../components/common/ExecutionPreviewPanel";
import { PageHeader } from "../components/common/PageHeader";
import { ConfidenceHelp } from "../components/common/ConfidenceHelp";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { getExecutionPreview, loadAuditPacket, saveAuditPacket, type AuditPacket, type SpecTrace } from "../lib/agenticAudit";
import { fetchAuditPacketFromServer } from "../lib/auditServer";
import { getAuditEvents } from "../lib/auditEventsServer";
import { formatTimestamp } from "../lib/formatters";

const GOV_NARRATIVE_ENABLED = import.meta.env.VITE_FEATURE_GOV_NARRATIVE === "true";
const EXEC_PREVIEW_ENABLED = import.meta.env.VITE_FEATURE_EXEC_PREVIEW === "true";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

export function GovernanceNarrativePage() {
  const query = useQuery();
  const navigate = useNavigate();
  const initialHash = query.get("hash") ?? "";

  const [packet, setPacket] = useState<AuditPacket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadSource, setLoadSource] = useState<"local" | "server" | null>(null);
  const [hashInput, setHashInput] = useState(initialHash);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [talkTrackOpen, setTalkTrackOpen] = useState(true);
  const [execPreviewOpen, setExecPreviewOpen] = useState(false);
  const [overrideEvents, setOverrideEvents] = useState<
    Array<{
      id: string;
      createdAt: string;
      payload: Record<string, unknown>;
    }>
  >([]);

  const specTrace: SpecTrace | undefined = packet?.decision_trace?.spec;
  const executionPreview = getExecutionPreview(packet);

  const loadByHash = useCallback(async (hash: string) => {
    if (!hash) return;
    setLoading(true);
    setError(null);
    setPacket(null);
    setLoadSource(null);

    const localResult = loadAuditPacket(hash);
    if (localResult.error) {
      setError(localResult.error);
      setLoading(false);
      return;
    }
    if (localResult.packet) {
      setPacket(localResult.packet);
      setLoadSource("local");
      setLoading(false);
      return;
    }

    const remoteResult = await fetchAuditPacketFromServer(hash);
    if (remoteResult.ok) {
      setPacket(remoteResult.data);
      setLoadSource("server");
      const saveResult = saveAuditPacket(remoteResult.data, hash);
      if (!saveResult.ok && saveResult.error) {
        setError(saveResult.error);
      }
      setLoading(false);
      return;
    }

    setError(remoteResult.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!initialHash) return;
    loadByHash(initialHash).catch(() => setLoading(false));
  }, [initialHash, loadByHash]);

  useEffect(() => {
    setHashInput(initialHash);
  }, [initialHash]);

  useEffect(() => {
    const loadOverrides = async () => {
      if (!packet?.metadata?.caseId) {
        setOverrideEvents([]);
        return;
      }
      const response = await getAuditEvents({ caseId: packet.metadata.caseId, packetHash: packet.packetHash ?? undefined });
      if (!response.ok) return;
      const items = response.data?.items ?? [];
      const overrides = items
        .filter((event: { eventType?: string }) => event.eventType === "override_feedback")
        .map((event: { id: string; createdAt: string; payload: Record<string, unknown> }) => ({
          id: event.id,
          createdAt: event.createdAt,
          payload: event.payload,
        }));
      setOverrideEvents(overrides);
    };

    loadOverrides();
  }, [packet?.metadata?.caseId, packet?.packetHash]);

  const handleLoad = () => {
    if (!hashInput.trim()) return;
    navigate(`/governance/narrative?hash=${encodeURIComponent(hashInput.trim())}`);
  };

  const handlePasteLoad = () => {
    try {
      const parsed = JSON.parse(pasteValue) as AuditPacket;
      if (!parsed || typeof parsed !== "object") {
        setError("Packet JSON must be an object.");
        return;
      }
      setPacket(parsed);
      setLoadSource("local");
      if (parsed.packetHash) {
        saveAuditPacket(parsed, parsed.packetHash);
      }
      setError(null);
    } catch {
      setError("Invalid JSON payload.");
    }
  };

  const outcomeLabel = useMemo(() => {
    const status = packet?.decision?.status ?? "";
    if (status.includes("approved")) return "Allow";
    if (status.includes("rejected")) return "Reject";
    return "Flag";
  }, [packet?.decision?.status]);

  const severityLabel = useMemo(() => {
    const risk = packet?.decision?.riskLevel ?? packet?.caseSnapshot?.riskLevel ?? "";
    return risk ? String(risk).toUpperCase() : "--";
  }, [packet?.decision?.riskLevel, packet?.caseSnapshot?.riskLevel]);

  const confidenceLabel = useMemo(() => {
    const confidence = packet?.decision?.confidence;
    if (typeof confidence !== "number") return "--";
    return `${Math.round(confidence * 100)}%`;
  }, [packet?.decision?.confidence]);

  const driftBadge = specTrace?.drift !== null && specTrace?.drift !== undefined
    ? {
        label: specTrace.drift && specTrace.latestSpecVersion !== null && specTrace.latestSpecVersion !== undefined
          ? `Spec v${specTrace.specVersionUsed}, latest v${specTrace.latestSpecVersion}`
          : `Spec v${specTrace.specVersionUsed} (latest)`,
        variant: (specTrace.drift ? "warning" : "secondary") as "warning" | "secondary",
      }
    : null;

  if (!GOV_NARRATIVE_ENABLED) {
    return (
      <EmptyState
        title="Governance narrative disabled"
        description="Enable VITE_FEATURE_GOV_NARRATIVE to access this page."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Governance Narrative"
        subtitle="Spec-to-system narrative for governance, drift awareness, and audit readiness."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              title="This decision flow is spec-driven, auditable, and supports human-in-the-loop governance."
            >
              Governed AI
            </Badge>
            {packet?.packetHash && (
              <Badge variant="secondary">Packet {packet.packetHash.slice(0, 10)}…</Badge>
            )}
            {loadSource && <Badge variant="info">Loaded from {loadSource}</Badge>}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {loading && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          )}

          {error && !loading && (
            <ErrorState title="Unable to load packet" description={error} onRetry={() => loadByHash(initialHash)} />
          )}

          {!loading && !packet && !error && (
            <EmptyState
              title="Load a packet to begin"
              description="Paste a packet hash or JSON to generate the narrative artifact."
            />
          )}

          {packet && (
            <>
              <SectionCard title="Specification">
                {specTrace ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{specTrace.specId}</Badge>
                      <Badge variant="secondary">v{specTrace.specVersionUsed}</Badge>
                      {driftBadge && <Badge variant={driftBadge.variant}>{driftBadge.label}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {specTrace.regulationRef ?? "No regulation reference"}
                    </p>
                    <p className="text-sm text-foreground">
                      {specTrace.snippet ?? "No spec snippet available."}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    This decision was generated before spec tracing was enabled.
                  </p>
                )}
              </SectionCard>

              <SectionCard title="Interpretation">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Parsed conditions</Badge>
                  <Badge variant="outline" className="inline-flex items-center gap-1">
                    Confidence {confidenceLabel}
                    <ConfidenceHelp size={12} />
                  </Badge>
                </div>
                {specTrace?.parsedConditions?.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                    {specTrace.parsedConditions.slice(0, 6).map((condition, index) => (
                      <li key={`${specTrace.specId}-condition-${index}`}>
                        {JSON.stringify(condition)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No parsed conditions captured.</p>
                )}
              </SectionCard>

              <SectionCard title="Decision">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">Outcome: {outcomeLabel}</Badge>
                  <Badge variant="secondary">Severity: {severityLabel}</Badge>
                  <Badge variant="secondary">
                    Constraints {specTrace?.constraintsTriggered?.length ?? 0}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  UI enforcement surfaces outcome, risk, and confidence badges without exposing raw chain-of-thought.
                </p>
              </SectionCard>

              <SectionCard title="Evidence">
                {packet.evidenceIndex.length ? (
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {packet.evidenceIndex.slice(0, 6).map((item) => {
                      const details = typeof item.details === "object" && item.details ? item.details as Record<string, unknown> : {};
                      const title = String(details?.title ?? details?.name ?? details?.label ?? item.type);
                      return (
                        <li key={item.id} className="rounded-md border border-border/70 bg-muted/20 p-2">
                          <p className="font-medium text-foreground">{title}</p>
                          <p>{item.source}</p>
                          <p>{formatTimestamp(item.timestamp)}</p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No evidence metadata captured.</p>
                )}
              </SectionCard>

              <SectionCard title="Human-in-the-loop">
                {overrideEvents.length ? (
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {overrideEvents.map((event) => (
                      <li key={event.id} className="rounded-md border border-border/70 bg-muted/20 p-2">
                        <p className="font-medium text-foreground">
                          Override: {String(event.payload?.reasonCategory ?? "override").replace(/_/g, " ")}
                        </p>
                        {event.payload?.note && (
                          <p>{String(event.payload.note)}</p>
                        )}
                        <p>{formatTimestamp(event.createdAt)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No human overrides recorded for this decision.</p>
                )}
              </SectionCard>

              {EXEC_PREVIEW_ENABLED && (
                <SectionCard title="Execution Preview (Read-only)">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Collapsed by default.</p>
                    <Button variant="ghost" size="sm" onClick={() => setExecPreviewOpen((prev) => !prev)}>
                      {execPreviewOpen ? "Hide" : "Show"}
                    </Button>
                  </div>
                  {execPreviewOpen && <ExecutionPreviewPanel preview={executionPreview} />}
                </SectionCard>
              )}

              <SectionCard title="Audit artifact">
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="rounded-md border border-border/70 bg-muted/20 p-2">
                    <p className="text-[11px] text-muted-foreground">Packet hash</p>
                    <p className="break-all text-foreground">{packet.packetHash ?? "--"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/audit/view?hash=${packet.packetHash ?? ""}`}>Open Audit View</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/audit/verify?hash=${packet.packetHash ?? ""}`}>Verify packet</Link>
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Demo Talk Track</h3>
                  <p className="text-xs text-muted-foreground">Short script for interview walkthroughs.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setTalkTrackOpen((prev) => !prev)}>
                  {talkTrackOpen ? "Hide" : "Show"}
                </Button>
              </div>
              {talkTrackOpen && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  <li>Flow: Spec → Interpretation → Decision → Evidence → HITL → Audit.</li>
                  <li>Drift badge flags when the decision used an older spec version.</li>
                  <li>Override feedback is captured as a governance signal (no chain-of-thought exposed).</li>
                  <li>Packet hash + verify link confirm audit integrity.</li>
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Live Example</h3>
                <p className="text-xs text-muted-foreground">Load a packet to populate the narrative.</p>
              </div>

              <div className="space-y-2">
                <Input
                  value={hashInput}
                  onChange={(event) => setHashInput(event.target.value)}
                  placeholder="Paste audit packet hash"
                  aria-label="Audit packet hash"
                />
                <Button size="sm" onClick={handleLoad} disabled={!hashInput.trim()}>
                  Load packet
                </Button>
              </div>

              <div className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPasteOpen((prev) => !prev)}
                >
                  {pasteOpen ? "Hide JSON paste" : "Paste packet JSON"}
                </Button>
                {pasteOpen && (
                  <div className="space-y-2">
                    <textarea
                      value={pasteValue}
                      onChange={(event) => setPasteValue(event.target.value)}
                      placeholder="Paste audit packet JSON"
                      className="min-h-[140px] w-full rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                    <Button size="sm" onClick={handlePasteLoad} disabled={!pasteValue.trim()}>
                      Load from JSON
                    </Button>
                  </div>
                )}
              </div>

              {packet && (
                <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">Current packet</p>
                  <p>{packet.metadata?.caseId ?? "--"}</p>
                  <p>{packet.metadata?.decisionId ?? "--"}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-[11px] text-muted-foreground">
            This artifact is generated from recorded decision metadata.
          </p>
        </div>
      </div>
    </div>
  );
}
