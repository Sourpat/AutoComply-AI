import React from "react";
import { DecisionStatusBadge } from "./DecisionStatusBadge";

export function DecisionStatusLegend() {
  return (
    <div className="decision-status-legend">
      <h3>Decision Legend</h3>
      <ul>
        <li>
          <DecisionStatusBadge status="ok_to_ship" /> – decision engine is
          comfortable shipping based on current data.
        </li>
        <li>
          <DecisionStatusBadge status="needs_review" /> – something is missing
          or unusual; a human should review before shipping.
        </li>
        <li>
          <DecisionStatusBadge status="blocked" /> – do not ship until the
          underlying issues are resolved.
        </li>
      </ul>
    </div>
  );
}
