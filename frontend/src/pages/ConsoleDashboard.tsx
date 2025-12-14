import React from "react";
import "./ConsoleDashboard.css";

type DecisionStatus = "ok_to_ship" | "blocked" | "needs_review";

interface RecentDecisionRow {
  id: string;
  timestamp: string;
  scenario: string;
  status: DecisionStatus;
  riskLevel: "Low" | "Medium" | "High";
  csfType: "Practitioner" | "Hospital" | "Researcher";
}

interface ExpiringLicenseRow {
  id: string;
  accountName: string;
  jurisdiction: string;
  licenseType: string;
  expiresOn: string;
  daysRemaining: number;
}

const MOCK_DECISIONS: RecentDecisionRow[] = [
  {
    id: "AUTO-2025-00124",
    timestamp: "2025-01-15 10:12",
    scenario: "Ohio Hospital – Morphine ampoules",
    status: "ok_to_ship",
    riskLevel: "Low",
    csfType: "Hospital",
  },
  {
    id: "AUTO-2025-00123",
    timestamp: "2025-01-15 09:58",
    scenario: "NY Pharmacy – Oxycodone tablets",
    status: "blocked",
    riskLevel: "High",
    csfType: "Practitioner",
  },
  {
    id: "AUTO-2025-00122",
    timestamp: "2025-01-15 09:42",
    scenario: "Practitioner CSF – Ohio TDDD renewal",
    status: "needs_review",
    riskLevel: "Medium",
    csfType: "Practitioner",
  },
];

const MOCK_EXPIRING_LICENSES: ExpiringLicenseRow[] = [
  {
    id: "LIC-001",
    accountName: "Ohio Hospital – Main Campus",
    jurisdiction: "OH",
    licenseType: "TDDD – Category II",
    expiresOn: "2025-02-10",
    daysRemaining: 26,
  },
  {
    id: "LIC-002",
    accountName: "NY Pharmacy – Broadway",
    jurisdiction: "NY",
    licenseType: "NY Pharmacy License",
    expiresOn: "2025-02-01",
    daysRemaining: 17,
  },
];

const ConsoleDashboard: React.FC = () => {
  return (
    <div className="console-shell">
      {/* Sidebar */}
      <aside className="console-sidebar">
        <div className="console-sidebar-logo">
          <div className="console-logo-circle">A</div>
          <div>
            <div className="console-logo-title">AutoComply AI</div>
            <div className="console-logo-subtitle">Compliance Console</div>
          </div>
        </div>

        <nav className="console-nav">
          <div className="console-nav-section">Overview</div>
          <button className="console-nav-item console-nav-item--active">
            Dashboard
          </button>
          <button className="console-nav-item">CSF Forms</button>
          <button className="console-nav-item">Licenses</button>
          <button className="console-nav-item">Orders & Approvals</button>
          <button className="console-nav-item">RAG Explorer</button>

          <div className="console-nav-section">Admin</div>
          <button className="console-nav-item">Settings</button>
          <button className="console-nav-item">About AutoComply</button>
        </nav>

        <div className="console-sidebar-footer">
          <div className="console-sidebar-pill">
            <span className="console-sidebar-pill-label">
              Environment
            </span>
            <span className="console-sidebar-pill-value">Sandbox</span>
          </div>
          <div className="console-sidebar-footer-text">
            Safe to demo. Decisions are simulated using test accounts and
            mock DEA data.
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="console-main">
        {/* Top header */}
        <header className="console-header">
          <div>
            <h1 className="console-page-title">Compliance snapshot</h1>
            <p className="console-page-subtitle">
              One place to monitor controlled-substance risk, CSF pipeline,
              and license health across your accounts.
            </p>
          </div>

          <div className="console-header-right">
            <div className="console-tenant-switcher">
              <span className="console-tenant-label">Tenant</span>
              <select className="console-tenant-select" defaultValue="ohio">
                <option value="ohio">Ohio Hospital</option>
                <option value="ny-pharmacy">NY Pharmacy</option>
                <option value="practitioner-sandbox">
                  Practitioner Sandbox
                </option>
              </select>
            </div>

            <div className="console-header-actions">
              <button className="console-ghost-button">
                View trace replay
              </button>
              <button className="console-primary-button">
                Launch Practitioner CSF sandbox
              </button>
            </div>
          </div>
        </header>

        {/* Hero row */}
        <section className="console-hero-row">
          <div className="console-hero-card">
            <div className="console-hero-top">
              <div>
                <div className="console-hero-label">
                  Today’s compliance posture
                </div>
                <div className="console-hero-score">Low risk</div>
              </div>
              <div className="console-hero-badge">
                98.5% of orders auto-cleared
              </div>
            </div>

            <div className="console-hero-metrics">
              <div className="console-hero-metric">
                <div className="console-hero-metric-label">
                  CSF decisions (24h)
                </div>
                <div className="console-hero-metric-value">42</div>
                <div className="console-hero-metric-sub">4 blocked</div>
              </div>
              <div className="console-hero-metric">
                <div className="console-hero-metric-label">
                  Licenses near expiry
                </div>
                <div className="console-hero-metric-value">2</div>
                <div className="console-hero-metric-sub">
                  Both flagged to admin
                </div>
              </div>
              <div className="console-hero-metric">
                <div className="console-hero-metric-label">
                  RAG explainer coverage
                </div>
                <div className="console-hero-metric-value">93%</div>
                <div className="console-hero-metric-sub">
                  Decisions with explainable reasons
                </div>
              </div>
            </div>

            <div className="console-hero-footer">
              <span className="console-hero-footer-pill">
                Uses Ohio TDDD + DEA rules
              </span>
              <span className="console-hero-footer-pill">
                Built-in audit trail for every CSF decision
              </span>
            </div>
          </div>
        </section>

        {/* KPI row */}
        <section className="console-kpis-row">
          <div className="console-kpi-card">
            <div className="console-kpi-title">Controlled substance orders</div>
            <div className="console-kpi-main">
              <span className="console-kpi-value">134</span>
              <span className="console-kpi-chip console-kpi-chip--positive">
                +12.8% vs yesterday
              </span>
            </div>
            <p className="console-kpi-subtext">
              Orders that flowed through AutoComply’s decision engine in the last 24 hours.
            </p>
          </div>

          <div className="console-kpi-card">
            <div className="console-kpi-title">CSF pipeline</div>
            <div className="console-kpi-tags">
              <span className="console-kpi-tag">Approved: 32</span>
              <span className="console-kpi-tag">In review: 7</span>
              <span className="console-kpi-tag console-kpi-tag--warn">
                Blocked: 3
              </span>
            </div>
            <p className="console-kpi-subtext">
              Real-time view of Practitioner, Hospital, and Researcher CSF forms.
            </p>
          </div>

          <div className="console-kpi-card">
            <div className="console-kpi-title">License health</div>
            <div className="console-kpi-main">
              <span className="console-kpi-value">24</span>
              <span className="console-kpi-chip console-kpi-chip--neutral">
                2 near expiry
              </span>
            </div>
            <p className="console-kpi-subtext">
              DEA, TDDD, and state pharmacy licenses monitored for expiry windows.
            </p>
          </div>
        </section>

        {/* Lower row: table + alerts */}
        <section className="console-lower-row">
          {/* Recent decisions */}
          <div className="console-card console-decisions-card">
            <div className="console-card-header">
              <div>
                <h2 className="console-card-title">Recent decisions</h2>
                <p className="console-card-subtitle">
                  Traceable CSF and license decisions, ready for audit.
                </p>
              </div>
              <button className="console-ghost-button console-card-button">
                View full decision log
              </button>
            </div>

            <div className="console-table-wrapper">
              <table className="console-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Scenario</th>
                    <th>Status</th>
                    <th>Risk</th>
                    <th>CSF Type</th>
                    <th>Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_DECISIONS.map((row) => (
                    <tr key={row.id}>
                      <td>{row.timestamp}</td>
                      <td>{row.scenario}</td>
                      <td>
                        <span
                          className={`console-status-pill console-status-pill--${row.status}`}
                        >
                          {row.status === "ok_to_ship"
                            ? "Ok to ship"
                            : row.status === "blocked"
                            ? "Blocked"
                            : "Needs review"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`console-risk-pill console-risk-pill--${row.riskLevel.toLowerCase()}`}
                        >
                          {row.riskLevel}
                        </span>
                      </td>
                      <td>{row.csfType}</td>
                      <td>
                        <button className="console-link-button">
                          Open trace
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alerts & tasks */}
          <div className="console-card console-alerts-card">
            <div className="console-card-header">
              <div>
                <h2 className="console-card-title">Alerts & tasks</h2>
                <p className="console-card-subtitle">
                  What compliance teams should focus on next.
                </p>
              </div>
            </div>

            <div className="console-alerts-section">
              <h3 className="console-alerts-title">
                Licenses expiring in 30 days
              </h3>
              <ul className="console-alert-list">
                {MOCK_EXPIRING_LICENSES.map((row) => (
                  <li key={row.id} className="console-alert-item">
                    <div>
                      <div className="console-alert-main">
                        {row.accountName}
                      </div>
                      <div className="console-alert-meta">
                        {row.licenseType} · {row.jurisdiction}
                      </div>
                    </div>
                    <div className="console-alert-right">
                      <span className="console-alert-date">
                        {row.expiresOn}
                      </span>
                      <span className="console-alert-pill">
                        {row.daysRemaining} days left
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="console-alerts-section">
              <h3 className="console-alerts-title">
                Missing CSF attestations
              </h3>
              <p className="console-alerts-body">
                3 practitioner forms and 1 hospital form have missing or
                outdated attestations. These are already blocked in the CSF
                pipeline and surfaced here so admins can follow up before
                orders are placed.
              </p>
            </div>

            <div className="console-alerts-section">
              <h3 className="console-alerts-title">RAG source review</h3>
              <p className="console-alerts-body">
                2 regulatory artifacts were updated in the last 7 days.
                Use the RAG Explorer to validate that explanations still
                match Ohio TDDD and DEA language.
              </p>
              <button className="console-ghost-button console-card-button">
                Open RAG Explorer
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ConsoleDashboard;
