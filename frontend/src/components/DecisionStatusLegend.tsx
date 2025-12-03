import React from "react";
import { CheckCircle2, AlertTriangle, Ban } from "lucide-react";

type DecisionStatusLegendProps = {
  className?: string;
};

function StatusRow(props: {
  icon: React.ReactNode;
  label: string;
  badgeClassName: string;
  description: string;
}) {
  const { icon, label, badgeClassName, description } = props;
  return (
    <div className="flex items-start gap-3">
      <div
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${badgeClassName}`}
      >
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xs text-slate-300">{description}</p>
    </div>
  );
}

export function DecisionStatusLegend({ className }: DecisionStatusLegendProps) {
  return (
    <div
      className={
        "rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 shadow-md shadow-black/30 backdrop-blur " +
        (className ?? "")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">
            How to read decisions
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            Every CSF, license, and order engine normalizes its output to
            these three states so the whole system feels predictable.
          </p>
        </div>
        <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300">
          Consistent across flows
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <StatusRow
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}
          label="ok_to_ship"
          badgeClassName="bg-emerald-500/10 text-emerald-200 border border-emerald-500/30"
          description="All required licenses and forms are valid for this scenario. The engine is comfortable letting the order proceed without manual intervention."
        />

        <StatusRow
          icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
          label="needs_review"
          badgeClassName="bg-amber-500/10 text-amber-200 border border-amber-500/30"
          description="Something is missing, borderline, or ambiguous. The engine wants a human to review before the order can move forward."
        />

        <StatusRow
          icon={<Ban className="h-3.5 w-3.5 text-rose-300" />}
          label="blocked"
          badgeClassName="bg-rose-500/10 text-rose-200 border border-rose-500/30"
          description="A hard rule is violated (for example, no valid license in a restricted state). The engine blocks the order until the underlying issue is fixed."
        />
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        When you run the Ohio or NY journeys, both the individual engines
        and the final mock order decisions report one of these three states,
        so it's easy to explain what's happening to stakeholders.
      </p>
    </div>
  );
}
