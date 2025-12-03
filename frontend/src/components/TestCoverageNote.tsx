import React from "react";
import { ShieldCheck } from "lucide-react";

type TestCoverageNoteProps = {
  label?: string;
  files: string[];
  size?: "sm" | "md";
};

export function TestCoverageNote({
  label = "Backed by automated tests",
  files,
  size = "sm",
}: TestCoverageNoteProps) {
  const wrapperClasses =
    size === "md"
      ? "mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2"
      : "mt-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1";

  return (
    <div className={`${wrapperClasses} text-[11px] text-emerald-50`}>
      <div className="flex items-start gap-2">
        <span className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20">
          <ShieldCheck className="h-3 w-3 text-emerald-200" />
        </span>
        <div className="space-y-0.5">
          <p className="font-medium">{label}</p>
          <p className="text-[10px] text-emerald-100/90">
            These flows are exercised via pytest before every CI build:
          </p>
          <ul className="mt-0.5 list-none space-y-0.5 text-[10px] text-emerald-100/80">
            {files.map((file) => (
              <li key={file} className="font-mono">
                {file}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
