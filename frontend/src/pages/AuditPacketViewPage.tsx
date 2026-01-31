import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/common/PageHeader";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { loadAuditPacket, saveAuditPacket, type AuditPacket } from "../lib/agenticAudit";
import { fetchAuditPacketFromServer } from "../lib/auditServer";
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

  const packetResult = useMemo(() => (hash ? loadAuditPacket(hash) : null), [hash]);

  useEffect(() => {
    if (!hash) return;
    if (packetResult?.packet) {
      setPacket(packetResult.packet);
      return;
    }
    if (packetResult?.error) {
      setError(packetResult.error);
      return;
    }
    setLoading(true);
    fetchAuditPacketFromServer(hash)
      .then((result) => {
        if (result.ok) {
          setPacket(result.data);
          const saveResult = saveAuditPacket(result.data, hash);
          if (!saveResult.ok && saveResult.error) {
            setError(saveResult.error);
          }
        } else {
          if (result.status === 404) {
            setError(null);
          } else {
            setError(result.message);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [hash, packetResult]);

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
      <EmptyState
        title="Loading audit packet"
        description="Fetching packet from local storage or server."
      />
    );
  }

  if (!packet) {
    return (
      <EmptyState
        title="Packet not found on this device"
        description="Packet not found locally or on server."
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
          {packet.humanActions.events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No human actions recorded.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {packet.humanActions.events.map((event) => (
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
          <p className="text-xs text-muted-foreground">{packet.packetHash ?? hash}</p>
        </CardContent>
      </Card>
    </div>
  );
}
