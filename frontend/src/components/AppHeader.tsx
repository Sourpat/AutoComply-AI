import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useRole, getRoleDisplayName, getRoleIcon, type UserRole } from "../context/RoleContext";

type AppHeaderProps = {
  onToggleDevSupport?: () => void;
};

// Navigation configuration - single source of truth
type NavItem = {
  to: string;
  label: string;
  group: "primary" | "suites" | "more" | "admin";
  exact?: boolean;
};

const navConfig: NavItem[] = [
  // Primary navigation (always visible on desktop)
  { to: "/", label: "Home", group: "primary", exact: true },
  { to: "/chat", label: "Chat", group: "primary" },
  { to: "/console", label: "Console", group: "primary" },
  
  // Admin items (shown when unlocked)
  { to: "/admin/review", label: "Review Queue", group: "admin" },
  { to: "/admin/ops", label: "Ops", group: "admin" },
  
  // Suites dropdown
  { to: "/csf", label: "CSF Suite", group: "suites" },
  { to: "/license", label: "License Suite", group: "suites" },
  
  // More dropdown
  { to: "/coverage", label: "Coverage", group: "more" },
  { to: "/analytics", label: "Analytics", group: "more" },
];

function isAdminUnlocked(): boolean {
  return localStorage.getItem("admin_unlocked") === "true";
}

// Dropdown component
function NavDropdown({ 
  label, 
  items, 
  isActive 
}: { 
  label: string; 
  items: NavItem[]; 
  isActive: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onBlur={(e) => {
          // Close dropdown when focus leaves, but allow clicking items
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setTimeout(() => setIsOpen(false), 150);
          }
        }}
        className={`px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1 transition-all ${
          isActive
            ? "text-white bg-cyan-600/20 border border-cyan-500/50"
            : "text-slate-200 hover:text-white hover:bg-slate-800/70"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={`${label} menu`}
      >
        {label}
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute left-0 mt-1 w-48 rounded-lg bg-slate-900 ring-1 ring-slate-700 shadow-lg z-50 py-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `block px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-cyan-600/20 text-cyan-400 font-medium"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Mobile menu component
function MobileMenu({ 
  items, 
  showAdmin, 
  onClose 
}: { 
  items: NavItem[]; 
  showAdmin: boolean; 
  onClose: () => void;
}) {
  const primaryItems = items.filter(i => i.group === "primary");
  const adminItems = items.filter(i => i.group === "admin");
  const suitesItems = items.filter(i => i.group === "suites");
  const moreItems = items.filter(i => i.group === "more");

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Menu panel */}
      <div className="fixed inset-y-0 left-0 w-72 bg-slate-950 border-r border-slate-800 shadow-2xl overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white">Menu</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Nav sections */}
          <nav className="space-y-6">
            {/* Primary */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Primary</h3>
              <div className="space-y-1">
                {primaryItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-cyan-600/20 text-cyan-400 border border-cyan-500/50"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Admin (if unlocked) */}
            {showAdmin && adminItems.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Admin</h3>
                <div className="space-y-1">
                  {adminItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-cyan-600/20 text-cyan-400 border border-cyan-500/50"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                        }`
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}

            {/* Suites */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Suites</h3>
              <div className="space-y-1">
                {suitesItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-cyan-600/20 text-cyan-400 border border-cyan-500/50"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>

            {/* More */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">More</h3>
              <div className="space-y-1">
                {moreItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-cyan-600/20 text-cyan-400 border border-cyan-500/50"
                          : "text-slate-300 hover:bg-slate-800 hover:text-white"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}

export function AppHeader({ onToggleDevSupport }: AppHeaderProps) {
  const [showAdmin, setShowAdmin] = useState(isAdminUnlocked());
  const { role, setRole } = useRole();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleStorageChange = () => {
      setShowAdmin(isAdminUnlocked());
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Filter items based on admin unlock
  const visibleItems = showAdmin ? navConfig : navConfig.filter(i => i.group !== "admin");
  
  const primaryItems = visibleItems.filter(i => i.group === "primary");
  const adminItems = visibleItems.filter(i => i.group === "admin");
  const suitesItems = visibleItems.filter(i => i.group === "suites");
  const moreItems = visibleItems.filter(i => i.group === "more");

  // Check if current path is in a group
  const isSuitesActive = suitesItems.some(item => location.pathname.startsWith(item.to));
  const isMoreActive = moreItems.some(item => location.pathname.startsWith(item.to));

  return (
    <header className="sticky top-0 z-50 bg-slate-950/70 backdrop-blur-md border-b border-white/10 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Left: Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mobile hamburger */}
            <button
              onClick={() => setShowMobileMenu(true)}
              className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo */}
            <NavLink to="/" className="text-xl font-semibold tracking-tight text-white hover:text-cyan-400 transition-colors">
              AutoComply AI
            </NavLink>
          </div>

          {/* Center: Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2 flex-1 justify-center">
            {/* Primary nav items */}
            {primaryItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "text-white bg-cyan-600/20 border border-cyan-500/50"
                      : "text-slate-200 hover:text-white hover:bg-slate-800/70"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}

            {/* Admin items (if unlocked) */}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "text-white bg-cyan-600/20 border border-cyan-500/50"
                      : "text-slate-200 hover:text-white hover:bg-slate-800/70"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}

            {/* Suites dropdown */}
            {suitesItems.length > 0 && (
              <NavDropdown label="Suites" items={suitesItems} isActive={isSuitesActive} />
            )}

            {/* More dropdown */}
            {moreItems.length > 0 && (
              <NavDropdown label="More" items={moreItems} isActive={isMoreActive} />
            )}
          </nav>

          {/* Right: Role & DevSupport */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Role Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 bg-slate-900 text-slate-200 ring-slate-700 hover:ring-cyan-500/60 transition-all"
                title="Switch role"
                aria-label="Switch user role"
                aria-expanded={showRoleDropdown}
              >
                <span>{getRoleIcon(role)}</span>
                <span className="hidden sm:inline">{getRoleDisplayName(role)}</span>
                <svg className={`w-3 h-3 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showRoleDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowRoleDropdown(false)}
                  />
                  
                  <div className="absolute right-0 mt-1 w-40 rounded-lg bg-slate-900 ring-1 ring-slate-700 shadow-lg z-50 py-1">
                    {(['submitter', 'verifier', 'admin'] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          setRole(r);
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm font-medium flex items-center gap-2 transition-colors ${
                          role === r
                            ? 'bg-cyan-600/20 text-cyan-400'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span>{getRoleIcon(r)}</span>
                        <span>{getRoleDisplayName(r)}</span>
                        {role === r && <span className="ml-auto text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            {/* DevSupport button */}
            {onToggleDevSupport && (
              <button
                type="button"
                onClick={onToggleDevSupport}
                className="hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ring-1 bg-slate-900 text-slate-200 ring-slate-700 hover:ring-cyan-500/60 transition-all"
                aria-label="Toggle developer support panel"
              >
                DevSupport
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {showMobileMenu && (
        <MobileMenu 
          items={visibleItems} 
          showAdmin={showAdmin} 
          onClose={() => setShowMobileMenu(false)} 
        />
      )}
    </header>
  );
}
