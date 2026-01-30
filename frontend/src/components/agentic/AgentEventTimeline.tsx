import React, { useEffect, useState } from "react";

import type { CaseEvent } from "../../contracts/agentic";
import { API_BASE } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

const eventTone: Record<string, "secondary" | "info" | "warning" | "success" | "destructive"> = {
  agent_plan: "info",
  user_input: "warning",
  action: "secondary",
  status_change: "success",
};

export function AgentEventTimeline({ caseId }: { caseId: string }) {
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/agentic/cases/${caseId}/events`);
        if (!response.ok) {
          throw new Error(`Failed to load events (${response.status})`);
        }
        const data = (await response.json()) as CaseEvent[];
        if (active) setEvents(data);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [caseId]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <h4 className="text-sm font-semibold text-foreground">Event timeline</h4>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="text-xs text-muted-foreground">No events yet.</p>
        )}
        {!loading && !error && events.length > 0 && (
          <ul className="space-y-3">
            {events.map((event) => (
              <li key={event.id} className="rounded-lg border border-border/70 bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={eventTone[event.type] ?? "secondary"}>{event.type}</Badge>
                  <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                </div>
                <pre className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
