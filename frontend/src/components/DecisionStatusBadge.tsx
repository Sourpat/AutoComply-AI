import React from "react";

import type { DecisionStatus } from "../types/decision";
import { RiskPill } from "./RiskPill";

interface DecisionStatusBadgeProps {
  status: DecisionStatus | null | undefined;
  labelPrefix?: string;
  riskLevel?: string | null;
}

/**
 * Renders a small colored badge for a decision status.
 * Used for CSF, license, and order-level decisions.
 */
export function DecisionStatusBadge({
  status,
  labelPrefix,
  riskLevel,
}: DecisionStatusBadgeProps) {
  if (!status) {
    return <span className="badge badge-unknown">unknown</span>;
  }

  const normalized = String(status);

  let label = normalized;
  if (normalized === "ok_to_ship") {
    label = "OK to ship";
  } else if (normalized === "needs_review") {
    label = "Needs review";
  } else if (normalized === "blocked") {
    label = "Blocked";
  }

  const className = `badge badge-${normalized}`;

  const badge = (
    <span className={className}>
      {labelPrefix ? `${labelPrefix}: ${label}` : label}
    </span>
  );

  if (!riskLevel) {
    return badge;
  }

  return (
    <span className="inline-flex items-center gap-2">
      {badge}
      <RiskPill riskLevel={riskLevel} />
    </span>
  );
}
