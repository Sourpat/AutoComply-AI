import React from "react";
import { NavLink } from "react-router-dom";
import { Github } from "lucide-react";

const navItems = [
  { to: "/", label: "Home", exact: true },
  { to: "/csf", label: "CSF Suite" },
  { to: "/license", label: "License Suite" },
  { to: "/console", label: "Compliance Console" },
];

function navLinkClassName(isActive: boolean) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition";
  if (isActive) {
    return (
      base +
      " bg-slate-900 text-cyan-200 border border-cyan-500/50 shadow-sm shadow-cyan-500/20"
    );
  }
  return (
    base +
    " text-slate-300 border border-transparent hover:border-slate-600 hover:bg-slate-900/70"
  );
}

export function AppHeader() {
  return (
    <header className="border-b border-slate-900/80 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-cyan-500/15">
            <span className="text-[13px] font-semibold text-cyan-300">
              AC
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-50">
              AutoComply AI
            </span>
            <span className="text-[10px] text-slate-400">
              CSF · Licenses · Mock orders
            </span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="hidden items-center gap-2 sm:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => navLinkClassName(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* GitHub CTA */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/Sourpat/AutoComply-AI"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:border-cyan-500/60 hover:bg-slate-800"
            title="View source on GitHub"
          >
            <Github className="h-3.5 w-3.5" />
            <span>Repo</span>
          </a>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="border-t border-slate-900/80 px-4 pb-2 pt-1 sm:hidden">
        <nav className="flex flex-wrap gap-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => navLinkClassName(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
