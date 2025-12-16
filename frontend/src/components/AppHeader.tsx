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
    ? "px-4 py-2 rounded-md text-sm font-medium text-white bg-cyan-600/20 border border-cyan-500/40"
    : "px-4 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800";
}

export function AppHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-slate-950/95 to-slate-900/80 backdrop-blur border-b border-slate-800">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between">
          
          {/* Left spacer */}
          <div className="w-1/3" />

          {/* Center brand */}
          <div className="w-1/3 text-center">
            <div className="text-xl font-semibold tracking-tight text-white">
              AutoComply AI
            </div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400">
              Compliance Platform
            </div>
          </div>

          {/* Right nav */}
          <nav className="w-1/3 flex justify-end gap-2">
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
