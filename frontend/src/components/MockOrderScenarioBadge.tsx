import React from "react";
import { CheckCircle2, AlertTriangle, Activity } from "lucide-react";

export type MockOrderScenarioSeverity =
  | "happy_path"
  | "edge_case"
  | "investigate";

export type MockOrderScenarioBadgeProps = {
  label: string;
  severity?: MockOrderScenarioSeverity;
};

export function MockOrderScenarioBadge({
  label,
  severity = "happy_path",
}: MockOrderScenarioBadgeProps) {
  const icon =
    severity === "happy_path"
      ? CheckCircle2
      : severity === "edge_case"
      ? AlertTriangle
      : Activity;

  const Icon = icon;

  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium";

  const stylesBySeverity: Record<MockOrderScenarioSeverity, string> = {
    happy_path:
      "border-emerald-500/60 bg-emerald-500/15 text-emerald-100 shadow-sm shadow-emerald-900/50",
    edge_case:
      "border-amber-400/70 bg-amber-500/15 text-amber-50 shadow-sm shadow-amber-900/50",
    investigate:
      "border-cyan-400/70 bg-cyan-500/15 text-cyan-50 shadow-sm shadow-cyan-900/50",
  };

  return (
    <span className={`${base} ${stylesBySeverity[severity]}`}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </span>
  );
}
