import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { loadAuditPacket, saveAuditPacket, type AuditPacket, type SpecTrace } from "../lib/agenticAudit";
import { fetchAuditPacketFromServer } from "../lib/auditServer";
import { getAuditEvents } from "../lib/auditEventsServer";
import { formatTimestamp } from "../lib/formatters";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function AuditPacketViewPage() {
  const query = useQuery();
  const hash = query.get("hash") ?? "";
  const caseId = query.get("caseId") ?? "";
  const decisionId = query.get("decisionId") ?? "";

  const [packet, setPacket] = useState<AuditPacket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadSource, setLoadSource] = useState<"local" | "server" | null>(null);
  const [serverAttempted, setServerAttempted] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [specSnippetOpen, setSpecSnippetOpen] = useState(false);
  const [specConditionsOpen, setSpecConditionsOpen] = useState(false);
  const [serverEvents, setServerEvents] = useState<
    Array<{
      id: string;
      caseId: string;
      eventType: string;
      createdAt: string;
      payload: Record<string, unknown>;
    }>
  >([]);

  const packetResult = useMemo(() => (hash ? loadAuditPacket(hash) : null), [hash]);
  const specTrace: SpecTrace | undefined = packet?.decision_trace?.spec;

  const specBadgeVariant = (severity?: string) => {
    if (!severity) return "secondary" as const;
    const normalized = severity.toLowerCase();
    if (normalized === "high" || normalized === "critical") return "destructive" as const;
    if (normalized === "medium") return "warning" as const;
    return "secondary" as const;
  };

  const specVersionBadge = specTrace?.drift !== null && specTrace?.drift !== undefined
    ? {
        label: specTrace.drift && specTrace.latestSpecVersion !== null && specTrace.latestSpecVersion !== undefined
          ? `Spec v${specTrace.specVersionUsed}, latest v${specTrace.latestSpecVersion}`
          : `Spec v${specTrace.specVersionUsed} (latest)`,
        variant: (specTrace.drift ? "warning" : "secondary") as "warning" | "secondary",
      }
    : null;

  const loadFromServer = useCallback(
    async (options?: { preserveCurrent?: boolean }) => {
      if (!hash) return;
      setLoading(true);
      setError(null);
      setServerAttempted(true);
      if (!options?.preserveCurrent) {
        setPacket(null);
        setLoadSource(null);
      }

      const result = await fetchAuditPacketFromServer(hash);
      if (result.ok) {
        setPacket(result.data);
        setLoadSource("server");
        const saveResult = saveAuditPacket(result.data, hash);
        if (!saveResult.ok && saveResult.error) {
          setError(saveResult.error);
        }
      } else if (result.status !== 404) {
        setError(result.message);
      }
      setLoading(false);
    },
    [hash]
  );

  useEffect(() => {
    if (!hash) return;
    setError(null);
    setLoading(true);
    setPacket(null);
    setLoadSource(null);
    setServerAttempted(false);

    if (packetResult?.packet) {
      setPacket(packetResult.packet);
      setLoadSource("local");
      setLoading(false);
      return;
    }

    if (packetResult?.error) {
      setError(packetResult.error);
    }

    loadFromServer().catch(() => {
      setLoading(false);
    });
  }, [hash, packetResult, loadFromServer]);

  useEffect(() => {
    if (!hash && !caseId) return;
    const loadEvents = async () => {
      const response = await getAuditEvents({ caseId: caseId || undefined, packetHash: hash || undefined });
      if (!response.ok) return;
      setServerEvents(response.data?.items ?? []);
    };
    loadEvents();
  }, [hash, caseId]);

  if (!hash) {
    return (
      <EmptyState
        title="Missing audit packet hash"
        description="Provide a valid hash in the URL to view the packet."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Local storage unavailable"
        description={error}
        onRetry={() => loadFromServer()}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="grid gap-2 md:grid-cols-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!packet) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Packet not found</h3>
            <p className="text-sm text-muted-foreground">
              This hash is not stored on this device. We also tried the server.
            </p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => loadFromServer()} disabled={!hash}>
              Retry server lookup
            </Button>
            <Button asChild variant="outline">
              <Link to="/audit/verify">Open Verify</Link>
            </Button>
          </div>
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => setPasteOpen((prev) => !prev)}>
              {pasteOpen ? "Hide paste" : "Paste packet JSON to view"}
            </Button>
            {pasteOpen && (
              <div className="space-y-2">
                <textarea
                  value={pasteValue}
                  onChange={(event) => setPasteValue(event.target.value)}
                  placeholder="Paste audit packet JSON here"
                  className="min-h-[160px] w-full rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    setError(null);
                    try {
                      const parsed = JSON.parse(pasteValue) as AuditPacket;
                      if (!parsed || typeof parsed !== "object") {
                        setError("Packet JSON must be an object.");
                        return;
                      }
                      if (!parsed.packetHash) {
                        setError("packetHash is required in pasted JSON.");
                        return;
                      }
                      setPacket(parsed);
                      setLoadSource("local");
                      saveAuditPacket(parsed, parsed.packetHash);
                      setPasteOpen(false);
                    } catch (err) {
                      setError("Invalid JSON payload.");
                    }
                  }}
                >
                  Load
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Packet View"
        subtitle="Read-only audit packet view."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {loadSource === "server" && <Badge variant="info">Loaded from server</Badge>}
            {loadSource === "local" && (
              <>
                <Badge variant="secondary">Loaded from this device</Badge>
                <Button variant="ghost" size="sm" onClick={() => loadFromServer({ preserveCurrent: true })}>
                  Switch to server
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Case {caseId || packet.metadata.caseId}</Badge>
            <Badge variant="secondary">Decision {decisionId || packet.metadata.decisionId}</Badge>
            <Badge variant="secondary">Hash {hash}</Badge>
          </div>

          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">Generated {formatTimestamp(packet.metadata.generatedAt)}</p>
            <p className="text-muted-foreground">Status {packet.decision.status}</p>
            <p className="text-muted-foreground">Risk {packet.decision.riskLevel ?? "unknown"}</p>
            <p className="text-muted-foreground">
              Confidence {packet.decision.confidence !== null ? Math.round(packet.decision.confidence * 100) + "%" : "--"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-foreground">Decision summary</h3>
          <p className="text-sm text-muted-foreground">
            {packet.explainability.summary ?? "No summary provided."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Decision trace</h3>
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(hash)}>
              Copy hash
            </Button>
          </div>
          <ul className="space-y-2 text-xs">
            {packet.timelineEvents.map((event) => (
              <li key={event.id} className="rounded-md border border-border/60 bg-background p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{event.type.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{formatTimestamp(event.timestamp)}</span>
                </div>
                <p className="mt-1 text-muted-foreground break-words">
                  {JSON.stringify(event.payload).slice(0, 180)}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Spec Trace</h3>
              <p className="text-xs text-muted-foreground">Spec-driven governance metadata (read-only).</p>
            </div>
            {specTrace && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{specTrace.specId}</Badge>
                <Badge variant="secondary">v{specTrace.specVersionUsed}</Badge>
                {specVersionBadge && (
                  <Badge variant={specVersionBadge.variant}>{specVersionBadge.label}</Badge>
                )}
              </div>
            )}
          </div>

          {!specTrace && (
            <p className="text-xs text-muted-foreground">
              This decision was generated before spec tracing was enabled.
            </p>
          )}

          {specTrace?.drift && (
            <p className="text-xs text-amber-600">Decision based on an older spec version.</p>
          )}

          {specTrace && (specTrace.regulationRef || specTrace.snippet) && (
            <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs">
              {specTrace.regulationRef && (
                <p className="text-muted-foreground">Ref: {specTrace.regulationRef}</p>
              )}
              {specTrace.snippet && (
                <div className="mt-2 space-y-2">
                  <p className="text-foreground">
                    {specSnippetOpen || specTrace.snippet.length <= 160
                      ? specTrace.snippet
                      : `${specTrace.snippet.slice(0, 160)}…`}
                  </p>
                  {specTrace.snippet.length > 160 && (
                    <Button variant="ghost" size="sm" onClick={() => setSpecSnippetOpen((prev) => !prev)}>
                      {specSnippetOpen ? "Collapse snippet" : "Expand snippet"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {specTrace?.rulesMeta?.length ? (
            <div className="flex flex-wrap gap-2">
              {specTrace.rulesMeta.map((rule) => (
                <Badge key={rule.ruleId} variant={specBadgeVariant(rule.severity)}>
                  {rule.ruleId} · {rule.severity}
                </Badge>
              ))}
            </div>
          ) : null}

          {specTrace?.parsedConditions?.length ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parsed conditions</p>
                <Button variant="ghost" size="sm" onClick={() => setSpecConditionsOpen((prev) => !prev)}>
                  {specConditionsOpen ? "Hide" : "Show"}
                </Button>
              </div>
              <ul className="space-y-2 text-xs">
                {(specConditionsOpen ? specTrace.parsedConditions : specTrace.parsedConditions.slice(0, 3)).map(
                  (condition, index) => (
                    <li key={index} className="rounded-md border border-border/70 bg-background p-2 text-muted-foreground">
                      {JSON.stringify(condition)}
                    </li>
                  )
                )}
              </ul>
              {!specConditionsOpen && specTrace.parsedConditions.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  {specTrace.parsedConditions.length - 3} more conditions hidden.
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-foreground">Evidence index</h3>
          {packet.evidenceIndex.length === 0 ? (
            <p className="text-xs text-muted-foreground">No evidence captured.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {packet.evidenceIndex.map((item) => (
                <li key={item.id} className="rounded-md border border-border/60 bg-background p-2">
                  <p className="font-medium text-foreground">{item.type.replace(/_/g, " ")}</p>
                  <p className="text-muted-foreground">{item.source}</p>
                  <p className="text-muted-foreground">{formatTimestamp(item.timestamp)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-foreground">Human actions</h3>
          {packet.humanActions.events.length === 0 && serverEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No human actions recorded.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {[...packet.humanActions.events.map((event) => ({
                id: event.id,
                eventType: event.type,
                createdAt: event.timestamp,
              })), ...serverEvents].map((event) => (
                <li key={event.id} className="rounded-md border border-border/60 bg-background p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{event.eventType.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{formatTimestamp(event.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-foreground">Packet hash</h3>
          <p className="text-xs text-muted-foreground">{packet.packetHash ?? hash}</p>
        </CardContent>
      </Card>
    </div>
  );
}
