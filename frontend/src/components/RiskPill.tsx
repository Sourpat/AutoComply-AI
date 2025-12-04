import React from "react";
import type { DecisionOutcome } from "../types/decision";

interface RiskPillProps {
  riskLevel?: DecisionOutcome["risk_level"];
  className?: string;
}

const LABELS: Record<string, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export const RiskPill: React.FC<RiskPillProps> = ({ riskLevel, className }) => {
  if (!riskLevel) return null;

  const label = LABELS[riskLevel] ?? `Risk: ${riskLevel}`;

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
