import React from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home", exact: true },
  { to: "/csf", label: "CSF Suite" },
  { to: "/license", label: "License Suite" },
  { to: "/console", label: "Compliance Console" },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? "px-3 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600/20 border border-cyan-500/50 shadow-[0_8px_30px_-12px_rgba(34,211,238,0.5)]"
    : "px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 hover:border hover:border-slate-700";
}

export function AppHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-slate-950/95 to-slate-900/80 backdrop-blur border-b border-slate-800/70">
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/70 via-indigo-500/70 to-emerald-500/70 text-base font-bold text-white shadow-lg shadow-cyan-500/25">
              A
            </div>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="text-2xl font-semibold tracking-tight text-white">
              AutoComply AI
            </div>
          </div>

          <nav className="flex flex-1 items-center justify-end gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={navLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
