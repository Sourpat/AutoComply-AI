import React from "react";
import type { DecisionOutcome } from "../types/decision";

interface RiskPillProps {
  riskLevel?: DecisionOutcome["risk_level"];
  labelOverride?: string;
  className?: string;
}

const LABELS: Record<string, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export const RiskPill: React.FC<RiskPillProps> = ({
  riskLevel,
  labelOverride,
  className,
}) => {
  if (!riskLevel) return null;

  const baseLabel = LABELS[riskLevel] ?? `Risk: ${riskLevel}`;
  const label = labelOverride ?? baseLabel;

  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border border-white/10 bg-white/5 " +
        (className ?? "")
      }
    >
      {label}
    </span>
  );
};
