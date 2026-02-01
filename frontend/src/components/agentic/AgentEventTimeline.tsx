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

type AgentEventTimelineProps = {
  caseId: string;
  extraEvents?: CaseEvent[];
};

export function AgentEventTimeline({ caseId, extraEvents = [] }: AgentEventTimelineProps) {
  const [events, setEvents] = useState<CaseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "agent" | "user" | "review" | "human">("all");
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(50);

  const combinedEvents = useMemo(() => {
    const merged = [...events, ...extraEvents];
    return merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [events, extraEvents]);

  const filteredEvents = useMemo(() => {
    const classify = (event: CaseEvent) => {
      if (event.type === "user_input") return "user";
      if (event.type === "action") {
        if (event.payload?.actor === "verifier") return "human";
        const actionId = String(event.payload?.actionId ?? "").toLowerCase();
        if (actionId.includes("review")) return "review";
        return "agent";
      }
      return "agent";
    };

    return combinedEvents.filter((event) => (filter === "all" ? true : classify(event) === filter));
  }, [combinedEvents, filter]);

  const visibleEvents = useMemo(() => {
    if (filteredEvents.length > 200) {
      return filteredEvents.slice(0, visibleCount);
    }
    return filteredEvents;
  }, [filteredEvents, visibleCount]);

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

    visibleEvents.forEach((event) => {
      const label = getLabel(event.timestamp);
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.label !== label) {
        groups.push({ label, items: [event] });
      } else {
        lastGroup.items.push(event);
      }
    });
    return groups;
  }, [visibleEvents]);

  const getEventIcon = (event: CaseEvent) => {
    if (event.payload?.actor === "verifier") return "🧑‍💼";
    if (event.type === "user_input") return "🧾";
    if (event.type === "status_change") return "✅";
    if (event.type === "agent_plan") return "🤖";
    const actionId = String(event.payload?.actionId ?? "").toLowerCase();
    if (actionId.includes("review")) return "🧑‍⚖️";
    return "⚙️";
  };

  const getPreview = (payload: Record<string, unknown>) => {
    if (payload?.type === "override_feedback") {
      const reason = String(payload?.reasonCategory ?? "override").replace(/_/g, " ");
      const note = typeof payload?.note === "string" ? payload.note.trim() : "";
      if (note) {
        return `Override: ${reason} — ${note.length > 120 ? `${note.slice(0, 120)}…` : note}`;
      }
      return `Override: ${reason}`;
    }
    const keys = Object.keys(payload ?? {}).slice(0, 6);
    if (keys.length === 0) return "No payload details";
    return `Keys: ${keys.join(", ")}${Object.keys(payload ?? {}).length > keys.length ? "…" : ""}`;
  };

  const getHumanLabel = (payload: Record<string, unknown>) => {
    if (payload?.type === "override_feedback") {
      const reason = String(payload?.reasonCategory ?? "override").replace(/_/g, " ");
      return `Override: ${reason}`;
    }
    return String(payload?.type ?? "human_action");
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

  useEffect(() => {
    setVisibleCount(50);
  }, [caseId, filter]);

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground">Event timeline</h4>
          <div className="flex flex-wrap gap-2">
            {(["all", "agent", "user", "review", "human"] as const).map((option) => (
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
                    const isExpanded = expandedEvents[event.id];
                    const details = isExpanded ? JSON.stringify(event.payload, null, 2) : getPreview(event.payload);
                    const showToggle = Object.keys(event.payload ?? {}).length > 0;
                    const isHuman = event.payload?.actor === "verifier";
                    const label = isHuman ? getHumanLabel(event.payload ?? {}) : event.type;
                    const tone = isHuman ? "secondary" : eventTone[event.type] ?? "secondary";

                    return (
                      <li key={event.id} className="rounded-lg border border-border/70 bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base" aria-hidden>
                              {getEventIcon(event)}
                            </span>
                            <Badge variant={tone}>{label}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{event.timestamp}</span>
                        </div>
                        {isExpanded ? (
                          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                            {details}
                          </pre>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">{details}</p>
                        )}
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
                            {isExpanded ? "Hide details" : "Show details"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {filteredEvents.length > 200 && visibleCount < filteredEvents.length && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((prev) => prev + 50)}
                >
                  Load more events
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
