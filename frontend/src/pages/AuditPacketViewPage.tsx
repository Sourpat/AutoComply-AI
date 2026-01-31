import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { loadAuditPacket, saveAuditPacket, type AuditPacket } from "../lib/agenticAudit";
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
      <EmptyState
        title="Local storage unavailable"
        description={error}
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
