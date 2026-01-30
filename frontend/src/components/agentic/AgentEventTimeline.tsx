import React, { useEffect, useMemo, useState } from "react";

import type { CaseEvent } from "../../contracts/agentic";
import { API_BASE } from "../../lib/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
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
  const [filter, setFilter] = useState<"all" | "agent" | "user" | "review">("all");
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const filteredEvents = useMemo(() => {
    const classify = (event: CaseEvent) => {
      if (event.type === "user_input") return "user";
      if (event.type === "action") {
        const actionId = String(event.payload?.actionId ?? "").toLowerCase();
        if (actionId.includes("review")) return "review";
        return "agent";
      }
      return "agent";
    };

    return events.filter((event) => (filter === "all" ? true : classify(event) === filter));
  }, [events, filter]);

  const groupedEvents = useMemo(() => {
    const groups: { label: string; items: CaseEvent[] }[] = [];
    const getLabel = (timestamp: string) => {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const dateKey = date.toDateString();
      if (dateKey === today.toDateString()) return "Today";
      if (dateKey === yesterday.toDateString()) return "Yesterday";
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    };

    filteredEvents.forEach((event) => {
      const label = getLabel(event.timestamp);
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        groups.push({ label, items: [event] });
      } else {
        lastGroup.items.push(event);
      }
    });
    return groups;
  }, [filteredEvents]);

  const getEventIcon = (event: CaseEvent) => {
    if (event.type === "user_input") return "🧾";
    if (event.type === "status_change") return "✅";
    if (event.type === "agent_plan") return "🤖";
    const actionId = String(event.payload?.actionId ?? "").toLowerCase();
    if (actionId.includes("review")) return "🧑‍⚖️";
    return "⚙️";
  };

  const getDetailsSnippet = (payload: Record<string, unknown>) => {
    return JSON.stringify(payload, null, 2);
  };

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">Event timeline</h4>
          <div className="flex flex-wrap gap-2">
            {(["all", "agent", "user", "review"] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={filter === option ? "default" : "outline"}
                onClick={() => setFilter(option)}
              >
                {option === "all" ? "All" : option.charAt(0).toUpperCase() + option.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {!loading && !error && filteredEvents.length === 0 && (
          <p className="text-xs text-muted-foreground">No events yet.</p>
        )}
        {!loading && !error && filteredEvents.length > 0 && (
          <div className="max-h-[520px] space-y-4 overflow-auto pr-2">
            {groupedEvents.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
                <ul className="space-y-3">
                  {group.items.map((event) => {
                    const details = getDetailsSnippet(event.payload);
                    const isExpanded = expandedEvents[event.id];
                    const showToggle = details.length > 220;
                    const displayDetails = showToggle && !isExpanded ? `${details.slice(0, 220)}…` : details;

                    return (
                      <li key={event.id} className="rounded-lg border border-border/70 bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base" aria-hidden>
                              {getEventIcon(event)}
                            </span>
                            <Badge variant={eventTone[event.type] ?? "secondary"}>{event.type}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                        </div>
                        <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                          {displayDetails}
                        </pre>
                        {showToggle && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedEvents((prev) => ({
                                ...prev,
                                [event.id]: !prev[event.id],
                              }))
                            }
                            className="mt-2 text-xs font-medium text-primary hover:underline"
                          >
                            {isExpanded ? "Show less" : "Show more"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
