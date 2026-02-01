import React from "react";

import { EmptyState } from "./EmptyState";
import { Badge } from "../ui/badge";

type ExecutionPreviewPanelProps = {
  preview: any | null;
};

const toArray = (value: any) => (Array.isArray(value) ? value : []);
const toText = (value: any, fallback = "--") => (typeof value === "string" ? value : fallback);

export function ExecutionPreviewPanel({ preview }: ExecutionPreviewPanelProps) {
  if (!preview) {
    return (
      <EmptyState
        title="Execution preview unavailable"
        description="Execution preview unavailable (flag off or missing signals)."
      />
    );
  }

  const affectedSystems = toArray(preview?.affectedSystems);
  const executionIntents = toArray(preview?.executionIntents);
  const uiImpacts = toArray(preview?.uiImpacts);
  const auditImpacts = toArray(preview?.auditImpacts);
  const readiness = preview?.readiness ?? {};
  const readinessMissing = toArray(readiness?.missing);
  const readinessStatus = toText(readiness?.status, "unknown");

  return (
    <div className="space-y-4 text-xs text-muted-foreground">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Affected systems</p>
        <div className="flex flex-wrap gap-2">
          {affectedSystems.length ? (
            affectedSystems.map((system: any, index: number) => (
              <Badge key={`${system?.id ?? "system"}-${index}`} variant="secondary">
                {toText(system?.label, "Unknown system")}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary">Unknown system</Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Execution intents</p>
        <div className="space-y-2">
          {executionIntents.length ? (
            executionIntents.map((intent: any, index: number) => (
              <div key={`${intent?.intent ?? "intent"}-${index}`} className="rounded-md border border-border/70 bg-muted/20 p-2">
                <p className="font-medium text-foreground">{toText(intent?.intent, "unknown")}</p>
                <p>{toText(intent?.reason, "No reason provided.")}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Spec: {toText(intent?.sourceRef?.specId, "--")} · Decision: {toText(intent?.sourceRef?.decisionId, "--")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Outcome: {toText(intent?.outcome?.decisionStatus, "--")} · Risk {toText(intent?.outcome?.riskLevel, "--")}
                </p>
              </div>
            ))
          ) : (
            <p>Unknown intents.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">UI impacts</p>
        <div className="space-y-2">
          {uiImpacts.length ? (
            uiImpacts.map((impact: any, index: number) => (
              <div key={`${impact?.type ?? "impact"}-${index}`} className="rounded-md border border-border/70 bg-muted/20 p-2">
                <p className="font-medium text-foreground">{toText(impact?.type, "unknown")}</p>
                <p>{toText(impact?.notes, "No notes available.")}</p>
              </div>
            ))
          ) : (
            <p>Unknown UI impacts.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Audit impacts</p>
        <div className="space-y-2">
          {auditImpacts.length ? (
            auditImpacts.map((impact: any, index: number) => (
              <div key={`${impact?.type ?? "audit"}-${index}`} className="rounded-md border border-border/70 bg-muted/20 p-2">
                <p className="font-medium text-foreground">{toText(impact?.type, "unknown")}</p>
                <p>{toText(impact?.notes, "No notes available.")}</p>
              </div>
            ))
          ) : (
            <p>Unknown audit impacts.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Readiness</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={readinessStatus === "complete" ? "success" : readinessStatus === "partial" ? "warning" : "secondary"}>
            {readinessStatus}
          </Badge>
          {readinessMissing.length ? (
            readinessMissing.map((missing: string, index: number) => (
              <Badge key={`${missing}-${index}`} variant="outline">
                {missing}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">no missing signals</Badge>
          )}
        </div>
      </div>
    </div>
  );
}