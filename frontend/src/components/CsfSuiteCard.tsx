import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

type CsfSuiteCardProps = {
  title: string;
  subtitle: string;
  bullets: string[];
  to: string;
  tag?: string;
};

export function CsfSuiteCard({
  title,
  subtitle,
  bullets,
  to,
  tag,
}: CsfSuiteCardProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 shadow-md shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && (
            <p className="mt-1 text-xs text-slate-300">{subtitle}</p>
          )}
        </div>
        {tag && (
          <span className="rounded-full bg-slate-800/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300">
            {tag}
          </span>
        )}
      </div>

      {bullets.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
          {bullets.map((item) => (
            <li key={item} className="flex gap-1">
              <span className="mt-[2px] text-slate-500">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex-1" />

      <Link
        to={to}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200"
      >
        Open sandbox
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
