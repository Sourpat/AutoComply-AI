import React from "react";

export type RegulatorySource = {
  title: string;
  url?: string; // will be a local /mnt/data/... path; hosting will transform it
  jurisdiction?: string;
  source?: string; // e.g. "regulatory_docs", "rules_stub"
};

type Props = {
  sources: RegulatorySource[];
  compact?: boolean;
};

export function RegulatorySourcesList({ sources, compact }: Props) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className={compact ? "mt-1" : "mt-2"}>
      <div className="mb-1 text-[10px] font-semibold text-slate-700">
        Sources used
      </div>
      <div className="flex flex-wrap gap-1">
        {sources.map((src, idx) => {
          const labelParts: string[] = [];
          if (src.title) labelParts.push(src.title);
          if (src.jurisdiction) labelParts.push(`[${src.jurisdiction}]`);
          if (src.source === "regulatory_docs") {
            labelParts.push("docs");
          } else if (src.source === "rules_stub") {
            labelParts.push("rules");
          }

          const label =
            labelParts.length > 0 ? labelParts.join(" · ") : `Source ${idx + 1}`;

          const commonClasses =
            "rounded-full px-2 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-300 bg-slate-50 hover:bg-slate-100";

          if (src.url) {
            return (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className={commonClasses}
              >
                {label}
              </a>
            );
          }

          return (
            <span key={idx} className={commonClasses}>
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
