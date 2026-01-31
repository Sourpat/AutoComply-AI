import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import type { CaseEvent } from "../../contracts/agentic";
import { formatTimestamp } from "../../lib/formatters";
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
};

function getSummary(event: CaseEvent) {
  const payload = event.payload ?? {};
  if (typeof payload.summary === "string") return payload.summary;
  if (typeof payload.note === "string") return payload.note;
  if (typeof payload.notes === "string") return payload.notes;
  if (typeof payload.decision === "string") return `Decision: ${payload.decision}`;
  if (typeof payload.actionId === "string") return `Action: ${payload.actionId}`;
  return JSON.stringify(payload).slice(0, 160);
}

export function DecisionTraceDrawer({ open, onOpenChange, events }: DecisionTraceDrawerProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(40);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (typeFilter !== "all" && event.type !== typeFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      const title = event.type.replace(/_/g, " ");
      const summary = getSummary(event);
      return `${title} ${summary}`.toLowerCase().includes(q);
    });
  }, [events, query, typeFilter]);

  const visibleEvents = useMemo(() => {
    if (filteredEvents.length > 200) {
      return filteredEvents.slice(0, visibleCount);
    }
    return filteredEvents;
  }, [filteredEvents, visibleCount]);

  const handleCopyPayload = async (event: CaseEvent) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(event.payload ?? {}, null, 2));
      toast.success("Payload copied");
    } catch {
      toast.error("Unable to copy payload");
    }
  };

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
            <Badge variant="secondary">{filteredEvents.length} steps</Badge>
          </div>

          <div className="max-h-[520px] space-y-3 overflow-auto pr-2">
            {visibleEvents.map((event) => {
              const isExpanded = expanded[event.id];
              return (
                <div key={event.id} className="rounded-lg border border-border/70 bg-background p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={toneByType[event.type] ?? "secondary"}>{event.type.replace(/_/g, " ")}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleCopyPayload(event)}>
                        Copy payload
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpanded((prev) => ({ ...prev, [event.id]: !prev[event.id] }))}
                      >
                        {isExpanded ? "Hide" : "View"}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-foreground">{getSummary(event)}</p>
                  {isExpanded && (
                    <pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">
                      {JSON.stringify(event.payload ?? {}, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
            {filteredEvents.length > 200 && visibleEvents.length < filteredEvents.length && (
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
