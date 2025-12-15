import React from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Home", exact: true },
  { to: "/csf", label: "CSF Suite" },
  { to: "/license", label: "License Suite" },
  { to: "/console", label: "Compliance Console" },
];

export function AppHeader() {
  return (
    <header className="ac-header">
      <div className="ac-header__brand">AutoComply AI</div>

      <nav className="ac-header__nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `ac-header__nav-link${
                isActive ? " ac-header__nav-link--active" : ""
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
