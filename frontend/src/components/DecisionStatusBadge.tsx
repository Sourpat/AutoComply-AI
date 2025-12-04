import React from "react";

import type { DecisionStatus } from "../types/decision";

interface DecisionStatusBadgeProps {
  status: DecisionStatus | null | undefined;
  labelPrefix?: string;
}

/**
 * Renders a small colored badge for a decision status.
 * Used for CSF, license, and order-level decisions.
 */
export function DecisionStatusBadge({
  status,
  labelPrefix,
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

  return (
    <span className={className}>
      {labelPrefix ? `${labelPrefix}: ${label}` : label}
    </span>
  );
}
