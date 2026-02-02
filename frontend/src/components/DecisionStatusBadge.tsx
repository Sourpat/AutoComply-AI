import React from "react";

import type { DecisionStatus, PolicyOverrideDetail, PolicyTrace, SafeFailureDetail } from "../types/decision";
import { RiskPill } from "./RiskPill";

interface DecisionStatusBadgeProps {
  status: DecisionStatus | null | undefined;
  labelPrefix?: string;
  riskLevel?: string | null;
  policyTrace?: PolicyTrace | null;
  safeFailure?: SafeFailureDetail | null;
  policyOverride?: PolicyOverrideDetail | null;
}

/**
 * Renders a small colored badge for a decision status.
 * Used for CSF, license, and order-level decisions.
 */
export function DecisionStatusBadge({
  status,
  labelPrefix,
  riskLevel,
  policyTrace,
  safeFailure,
  policyOverride,
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

  const policyAction = policyTrace?.allowed_action;
  const policyLabelMap: Record<string, string> = {
    auto_decide: "Policy: Auto",
    require_human: "Policy: Review",
    escalate: "Policy: Escalate",
    block: "Policy: Block",
  };
  const policyClassMap: Record<string, string> = {
    auto_decide: "badge badge-ok",
    require_human: "badge badge-degraded",
    escalate: "badge badge-degraded",
    block: "badge badge-down",
  };

  const overrideLabelMap: Record<string, string> = {
    approve: "Override: Approve",
    block: "Override: Block",
    require_review: "Override: Review",
  };

  return (
    <span className="inline-flex items-center gap-2">
      {badge}
      {policyAction && (
        <span className={policyClassMap[policyAction] ?? "badge badge-unknown"}>
          {policyLabelMap[policyAction] ?? "Policy"}
        </span>
      )}
      {safeFailure && (
        <span
          className="badge badge-degraded"
          title={safeFailure.summary}
        >
          Policy Override
        </span>
      )}
      {policyOverride && (
        <span
          className="badge badge-degraded"
          title={policyOverride.rationale}
        >
          {overrideLabelMap[policyOverride.override_action] ?? "Override applied"}
        </span>
      )}
      {riskLevel && <RiskPill riskLevel={riskLevel} />}
    </span>
  );
}
