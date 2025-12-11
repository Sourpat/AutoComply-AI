import React from "react";

interface VerticalBadgeProps {
  label: string;
}

export function VerticalBadge({ label }: VerticalBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/60 bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-100 shadow-sm">
      <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
      <span>{label}</span>
    </span>
  );
}
