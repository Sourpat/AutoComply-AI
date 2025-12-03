import React, { useState } from "react";
import { Info } from "lucide-react";

type UnderTheHoodInfoProps = {
  title?: string;
  lines: string[];
};

/**
 * Small badge + popover that explains what a card or journey does under the hood.
 * Intended for interview/demo storytelling.
 */
export function UnderTheHoodInfo({
  title = "Under the hood",
  lines,
}: UnderTheHoodInfoProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-900/70 px-2 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800/90"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Info className="h-3 w-3 text-cyan-300" />
        <span>{title}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-700/70 bg-slate-900/95 p-3 text-[11px] text-slate-200 shadow-lg shadow-black/40">
          <p className="mb-1 text-[11px] font-semibold text-slate-100">
            What this card actually does
          </p>
          <ul className="space-y-1">
            {lines.map((line) => (
              <li key={line} className="flex gap-1">
                <span className="mt-[2px] text-slate-500">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 text-[10px] font-medium text-slate-400 hover:text-slate-200"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
