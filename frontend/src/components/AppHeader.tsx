import { NavLink } from "react-router-dom";

export function AppHeader() {
  return (
    <header className="navbar">
      <div className="nav-container">
        {/* Brand on the left, clickable to Home */}
        <NavLink to="/" className="nav-brand">
          <div className="brand-logo">A</div>
          <div className="brand-text">
            <span className="brand-name">AutoComply AI</span>
            <span className="brand-tagline">Compliance Suite</span>
          </div>
        </NavLink>

        {/* Mobile menu button on the right (visible on small screens) */}
        <button
          className="mobile-menu-btn"
          type="button"
          aria-label="Toggle navigation"
          onClick={() => {
            const menu = document.querySelector(".nav-links");
            if (menu) {
              menu.classList.toggle("active");
            }
          }}
        >
          ☰
        </button>

        {/* Desktop nav links */}
        <ul className="nav-links">
          <li>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Home
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/csf"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              CSF Suite
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/license"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              License Suite
            </NavLink>
          </li>
          <li>
            <NavLink
              to="/console"
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              Compliance Console
            </NavLink>
          </li>
        </ul>
      </div>
    </header>
  );
}
