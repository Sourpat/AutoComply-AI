import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";

type AppHeaderProps = {
  onToggleDevSupport?: () => void;
};

const baseNavItems = [
  { to: "/", label: "Home", exact: true },
  { to: "/chat", label: "Chat" },
  { to: "/csf", label: "CSF Suite" },
  { to: "/license", label: "License Suite" },
  { to: "/console", label: "Compliance Console" },
];

const adminNavItems = [
  { to: "/admin/review", label: "Review Queue" },
  { to: "/admin/ops", label: "Ops Dashboard" },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive
    ? "px-3 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600/20 border border-cyan-500/50 shadow-[0_8px_30px_-12px_rgba(34,211,238,0.5)]"
    : "px-3 py-2 rounded-lg text-sm font-medium text-slate-200 hover:text-white hover:bg-slate-800/70 hover:border hover:border-slate-700";
}

function isAdminUnlocked(): boolean {
  return localStorage.getItem("admin_unlocked") === "true";
}

export function AppHeader({ onToggleDevSupport }: AppHeaderProps) {
  const [showAdmin, setShowAdmin] = useState(isAdminUnlocked());

  useEffect(() => {
    const handleStorageChange = () => {
      setShowAdmin(isAdminUnlocked());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const navItems = showAdmin 
    ? [...baseNavItems.slice(0, 2), ...adminNavItems, ...baseNavItems.slice(2)] 
    : baseNavItems;
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur border-b border-slate-800/70 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.85)]">
      <div className="mx-auto max-w-6xl px-6">
        {/* TOP ROW: brand */}
        <div className="h-10 flex items-center justify-center">
          <div className="text-xl font-semibold tracking-tight text-white drop-shadow-[0_6px_18px_rgba(34,211,238,0.25)]">
            AutoComply AI
          </div>
        </div>

        {/* BOTTOM ROW: nav + devsupport */}
        <div className="h-12 flex items-center pb-2">
          <div className="flex w-full items-center justify-center">
            <nav className="flex items-center justify-center gap-2 flex-wrap text-sm">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={(item as any).exact}
                  className={navLinkClass}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Right side button (doesn't affect centering) */}
            {onToggleDevSupport && (
              <button
                type="button"
                onClick={onToggleDevSupport}
                className="ml-auto inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 bg-slate-900 text-slate-200 ring-slate-700 hover:ring-cyan-500/60"
              >
                DevSupport
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
