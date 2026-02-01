import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import type { CaseEvent } from "../../contracts/agentic";
import { formatTimestamp } from "../../lib/formatters";
import { groupTraceEvents, getTraceMeta, getTraceLabel, type SpecTrace } from "../../lib/agenticAudit";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const typeOptions = [
  { value: "all", label: "All" },
  { value: "agent_plan", label: "Agent plan" },
  { value: "status_change", label: "Status change" },
  { value: "action", label: "Action" },
  { value: "user_input", label: "User input" },
];

const toneByType: Record<string, "secondary" | "info" | "warning" | "success"> = {
  agent_plan: "info",
  status_change: "success",
  action: "secondary",
  user_input: "warning",
};

type DecisionTraceDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: CaseEvent[];
  specTrace?: SpecTrace;
};

function getSummary(event: CaseEvent) {
  const meta = getTraceMeta(event);
  if (meta.summary) return meta.summary;
  const payload = event.payload ?? {};
  if (typeof payload.note === "string") return payload.note;
  if (typeof payload.notes === "string") return payload.notes;
  if (typeof payload.decision === "string") return `Decision: ${payload.decision}`;
  if (typeof payload.actionId === "string") return `Action: ${payload.actionId}`;
  return JSON.stringify(payload).slice(0, 160);
}

export function DecisionTraceDrawer({ open, onOpenChange, events, specTrace }: DecisionTraceDrawerProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(40);
  const [specSnippetOpen, setSpecSnippetOpen] = useState(false);
  const [specConditionsOpen, setSpecConditionsOpen] = useState(false);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (typeFilter !== "all" && event.type !== typeFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const title = getTraceLabel(event.type);
      const summary = getSummary(event);
      return `${title} ${summary}`.toLowerCase().includes(q);
    });
  }, [events, query, typeFilter]);

  const groupedEvents = useMemo(() => groupTraceEvents(filteredEvents), [filteredEvents]);

  const visibleGroups = useMemo(() => {
    if (groupedEvents.length > 200) {
      return groupedEvents.slice(0, visibleCount);
    }
    return groupedEvents;
  }, [groupedEvents, visibleCount]);

  const handleCopyPayload = async (payload: Record<string, unknown>) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload ?? {}, null, 2));
      toast.success("Payload copied");
    } catch {
      toast.error("Unable to copy payload");
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Decision Trace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search step name or summary"
              aria-label="Search decision trace"
              className="max-w-sm"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]" aria-label="Filter trace">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{groupedEvents.length} steps</Badge>
          </div>

          <div className="max-h-[520px] space-y-3 overflow-auto pr-2">
            {specTrace && (
              <div className="rounded-lg border border-border/70 bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Spec Trace</p>
                    <p className="text-xs text-muted-foreground">
                      {specTrace.specId} • v{specTrace.specVersionUsed}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{specTrace.specId}</Badge>
                    <Badge variant="secondary">v{specTrace.specVersionUsed}</Badge>
                    {specTrace.regulationRef && (
                      <Badge variant="outline">{specTrace.regulationRef}</Badge>
                    )}
                    {specVersionBadge && (
                      <Badge variant={specVersionBadge.variant}>{specVersionBadge.label}</Badge>
                    )}
                  </div>
                </div>

                {specTrace.drift && (
                  <p className="mt-2 text-xs text-amber-600">Decision based on an older spec version.</p>
                )}

                {specTrace.snippet && (
                  <div className="mt-3 space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSpecSnippetOpen((prev) => !prev)}
                    >
                      {specSnippetOpen ? "Hide" : "View"} regulation snippet
                    </Button>
                    {specSnippetOpen && (
                      <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                        {specTrace.snippet}
                      </div>
                    )}
                  </div>
                )}

                {specTrace.rulesMeta?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Rules applied</p>
                    <div className="flex flex-wrap gap-2">
                      {specTrace.rulesMeta.map((rule) => (
                        <Badge key={rule.ruleId} variant={specBadgeVariant(rule.severity)}>
                          {rule.ruleId} • {rule.severity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {specTrace.parsedConditions?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSpecConditionsOpen((prev) => !prev)}
                    >
                      {specConditionsOpen ? "Hide" : "View"} parsed conditions
                    </Button>
                    {specConditionsOpen && (
                      <div className="space-y-2">
                        {specTrace.parsedConditions.map((condition, idx) => (
                          <pre
                            key={`${specTrace.specId}-condition-${idx}`}
                            className="whitespace-pre-wrap rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground"
                          >
                            {JSON.stringify(condition, null, 2)}
                          </pre>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {visibleGroups.map((group) => {
              const isExpanded = expanded[group.id];
              const summary = group.meta.summary ?? JSON.stringify(group.payload).slice(0, 160);
              return (
                <div key={group.id} className="rounded-lg border border-border/70 bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={toneByType[group.type] ?? "secondary"}>{group.label}</Badge>
                      {group.count > 1 && (
                        <Badge variant="secondary">x{group.count} repeats</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {group.count > 1
                          ? `${formatTimestamp(group.firstTimestamp)} → ${formatTimestamp(group.lastTimestamp)}`
                          : formatTimestamp(group.firstTimestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleCopyPayload(group.payload)}>
                        Copy payload
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpanded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                      >
                        {isExpanded ? "Hide" : "View"}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {group.meta.status && <Badge variant="secondary">Status {group.meta.status}</Badge>}
                    {group.meta.nextState && <Badge variant="secondary">Next {group.meta.nextState}</Badge>}
                    {typeof group.meta.confidence === "number" && (
                      <Badge variant="secondary">Conf {Math.round(group.meta.confidence * 100)}%</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-foreground">{summary.length > 160 ? `${summary.slice(0, 160)}…` : summary}</p>
                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {JSON.stringify(group.payload ?? {}, null, 2)}
                      </pre>
                      {group.count > 1 && (
                        <div className="rounded-md border border-border/70 bg-muted/20 p-2 text-xs text-muted-foreground">
                          <p className="font-semibold text-foreground">Instances</p>
                          <ul className="mt-2 space-y-1">
                            {group.instances.map((instance) => (
                              <li key={instance.id}>
                                {formatTimestamp(instance.timestamp)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {groupedEvents.length > 200 && visibleGroups.length < groupedEvents.length && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setVisibleCount((prev) => prev + 40)}>
                  Load more
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
