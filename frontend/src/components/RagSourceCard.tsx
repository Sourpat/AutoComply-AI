import React from "react";
import type { RagSource } from "../types/rag";

interface RagSourceCardProps {
  source: RagSource;
  index?: number; // optional rank index starting from 0
}

export const RagSourceCard: React.FC<RagSourceCardProps> = ({ source, index }) => {
  const rank = typeof index === "number" ? index + 1 : undefined;
  const scorePercent = Math.round((source.score ?? 0) * 100);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            {rank !== undefined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-500/60 text-slate-200/90">
                #{rank}
              </span>
            )}
            <span className="text-xs font-semibold text-slate-50">
              {source.label || source.citation || "Regulatory reference"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1 mt-0.5">
            {source.jurisdiction && (
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border border-slate-600/80 text-slate-200/90">
                {source.jurisdiction}
              </span>
            )}
            {source.citation && (
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border border-slate-600/60 text-slate-200/80">
                {source.citation}
              </span>
            )}
            {source.source_type && (
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border border-slate-600/40 text-slate-300/80">
                {source.source_type}
              </span>
            )}
          </div>
        </div>

        {/* Score pill */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] text-slate-400">Score</span>
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-slate-300"
                style={{ width: `${scorePercent}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-300 tabular-nums">{scorePercent}%</span>
          </div>
        </div>
      </div>

      {/* Snippet */}
      <p className="text-xs text-slate-200/90 leading-snug line-clamp-4">{source.snippet}</p>

      {/* Optional URL footer */}
      {source.url && (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
        >
          Open source
        </a>
      )}
    </div>
  );
};
