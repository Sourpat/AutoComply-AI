import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { loadAuditPacket, type AuditPacket } from "../lib/agenticAudit";
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

  const packetResult = useMemo(() => (hash ? loadAuditPacket(hash) : null), [hash]);
  const fallbackPacket: AuditPacket | null = packetResult?.packet ?? null;

  if (!hash) {
    return (
      <EmptyState
        title="Missing audit packet hash"
        description="Provide a valid hash in the URL to view the packet."
      />
    );
  }

  if (packetResult?.error) {
    return (
      <EmptyState
        title="Local storage unavailable"
        description={packetResult.error}
      />
    );
  }

  if (!fallbackPacket) {
    return (
      <EmptyState
        title="Packet not found on this device"
        description="This share link points to a local packet that isn't stored in this browser."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Packet View"
        subtitle="Read-only audit packet loaded from local storage."
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Case {caseId || fallbackPacket.metadata.caseId}</Badge>
            <Badge variant="secondary">Decision {decisionId || fallbackPacket.metadata.decisionId}</Badge>
            <Badge variant="secondary">Hash {hash}</Badge>
          </div>

          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">Generated {formatTimestamp(fallbackPacket.metadata.generatedAt)}</p>
            <p className="text-muted-foreground">Status {fallbackPacket.decision.status}</p>
            <p className="text-muted-foreground">Risk {fallbackPacket.decision.riskLevel ?? "unknown"}</p>
            <p className="text-muted-foreground">
              Confidence {fallbackPacket.decision.confidence !== null ? Math.round(fallbackPacket.decision.confidence * 100) + "%" : "--"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-sm font-semibold text-foreground">Decision summary</h3>
          <p className="text-sm text-muted-foreground">
            {fallbackPacket.explainability.summary ?? "No summary provided."}
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
            {fallbackPacket.timelineEvents.map((event) => (
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
          {fallbackPacket.evidenceIndex.length === 0 ? (
            <p className="text-xs text-muted-foreground">No evidence captured.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {fallbackPacket.evidenceIndex.map((item) => (
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
          {fallbackPacket.humanActions.events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No human actions recorded.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {fallbackPacket.humanActions.events.map((event) => (
                <li key={event.id} className="rounded-md border border-border/60 bg-background p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{event.type.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{formatTimestamp(event.timestamp)}</span>
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
          <p className="text-xs text-muted-foreground">{fallbackPacket.packetHash ?? hash}</p>
        </CardContent>
      </Card>
    </div>
  );
}
