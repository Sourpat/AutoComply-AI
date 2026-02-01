import React from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "./EmptyState";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ConfidenceHelp } from "./ConfidenceHelp";

type ExecutionPreviewPanelProps = {
  preview: any | null;
  decision?: any | null;
  isFeatureEnabled?: boolean;
  showSeedCta?: boolean;
  seedHref?: string;
  demoMode?: boolean;
};

const toArray = (value: any) => (Array.isArray(value) ? value : []);
const toText = (value: any, fallback = "--") => (typeof value === "string" ? value : fallback);

export function ExecutionPreviewPanel({
  preview,
  isFeatureEnabled,
  showSeedCta,
  seedHref = "/audit/packets",
  demoMode,
}: ExecutionPreviewPanelProps) {
  if (!preview) {
    const description = isFeatureEnabled
      ? "Backend FEATURE_EXEC_PREVIEW may be off. Start backend with FEATURE_EXEC_PREVIEW=1. If it is on, seed demo packets."
      : "Enable VITE_FEATURE_EXEC_PREVIEW to view Execution Preview.";
    return (
      <div className="space-y-3">
        {demoMode && (
          <p className="text-[11px] text-muted-foreground">
            This is demo data generated locally. SDX is computed at read-time.
          </p>
        )}
        <EmptyState
          title="Execution Preview unavailable"
          description={description}
        />
        {isFeatureEnabled && showSeedCta && (
          <Button asChild variant="outline" size="sm">
            <Link to={seedHref}>Seed demo packets</Link>
          </Button>
        )}
      </div>
    );
  }

  const affectedSystems = toArray(preview?.affectedSystems);
  const executionIntents = toArray(preview?.executionIntents);
  const uiImpacts = toArray(preview?.uiImpacts);
  const auditImpacts = toArray(preview?.auditImpacts);
  const readiness = preview?.readiness ?? {};
  const readinessMissing = toArray(readiness?.missing);
  const readinessStatus = toText(readiness?.status, "unknown");
  const uiImpactSummary = preview?.ui_impacts_summary ?? {};
  const uiImpactCount = toArray(uiImpactSummary?.impacts).length;
  const uiImpactPrimary = toText(uiImpactSummary?.primary, "unknown");
  const specCompleteness = preview?.spec_completeness ?? {};
  const completenessStatus = toText(specCompleteness?.status, "UNKNOWN");
  const completenessMissing = toArray(specCompleteness?.missingDimensions);
  const specStability = preview?.spec_stability ?? {};
  const driftDetected = specStability?.drift === true;
  const executionConfidence = preview?.execution_confidence ?? {};
  const decisionConfidence = preview?.decision_confidence ?? {};
  const execScore = typeof executionConfidence?.score === "number" ? executionConfidence.score : null;
  const execLabel = toText(executionConfidence?.label, "UNKNOWN");
  const execExplain = toText(
    executionConfidence?.explain,
    "Execution confidence reflects readiness signals across spec, overrides, audit, and UI mappings."
  );
  const decisionScore = typeof decisionConfidence?.score === "number" ? decisionConfidence.score : null;
  const factorEntries = Object.entries(executionConfidence?.factors ?? {});
  const factorNotes = factorEntries
    .map(([name, factor]: [string, any]) => ({
      name,
      value: factor?.value,
      note: factor?.note,
    }))
    .filter((factor) => factor.note)
    .slice(0, 4);
  const reasons = toArray(executionConfidence?.reasons);
  const showReasons = execLabel !== "HIGH" || reasons.length > 0 || execScore === null;

  const stabilityLabel = driftDetected ? "Drift" : specStability?.drift === false ? "Stable" : "Unknown";

  return (
    <div className="space-y-4 text-xs text-muted-foreground">
      {demoMode && (
        <p className="text-[11px] text-muted-foreground">
          This is demo data generated locally. SDX is computed at read-time.
        </p>
      )}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">UI Impact Summary</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Primary: {uiImpactPrimary}</Badge>
          <Badge variant="outline">{uiImpactCount} impact(s)</Badge>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Spec Completeness</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              completenessStatus === "COMPLETE"
                ? "success"
                : completenessStatus === "INCOMPLETE"
                ? "destructive"
                : completenessStatus === "PARTIAL"
                ? "warning"
                : "secondary"
            }
          >
            {completenessStatus}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            Missing: {completenessMissing.length > 0
              ? `${completenessMissing.slice(0, 4).join(", ")}${
                  completenessMissing.length > 4 ? ` +${completenessMissing.length - 4} more` : ""
                }`
              : "Unknown"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Spec Stability</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={driftDetected ? "warning" : "secondary"}>{stabilityLabel}</Badge>
          {driftDetected && (
            <span className="text-[11px] text-amber-600">
              {toText(specStability?.versionUsed, "--")} → {toText(specStability?.latestVersion, "--")}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Confidence</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            Decision Confidence: {decisionScore !== null ? `${decisionScore}%` : "--"}
          </Badge>
          <Badge
            variant={execLabel === "HIGH" ? "success" : execLabel === "LOW" ? "destructive" : execLabel === "MEDIUM" ? "warning" : "secondary"}
            title={execExplain}
          >
            Execution Confidence: {execScore !== null ? `${execScore}%` : "--"} ({execLabel})
          </Badge>
          <ConfidenceHelp size={12} />
        </div>
        {factorNotes.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-[11px] text-muted-foreground">
            {factorNotes.map((factor) => (
              <li key={factor.name}>{toText(factor.note)}</li>
            ))}
          </ul>
        )}
        {showReasons && reasons.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Reasons: {reasons.slice(0, 3).join(" ")}{reasons.length > 3 ? "…" : ""}
          </p>
        )}
      </div>

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
                {toArray(intent?.uiImpacts).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {toArray(intent?.uiImpacts).map((impact: string, impactIndex: number) => (
                      <Badge key={`${impact}-${impactIndex}`} variant="outline">
                        {impact}
                      </Badge>
                    ))}
                  </div>
                )}
                {intent?.uiNote && (
                  <p className="mt-2 text-[11px] text-muted-foreground">{toText(intent?.uiNote)}</p>
                )}
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
            <Badge variant="outline">{readinessStatus === "unknown" ? "Unknown" : "no missing signals"}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}