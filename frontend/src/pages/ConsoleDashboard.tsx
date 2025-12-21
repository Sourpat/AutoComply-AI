import React, { useState, useEffect } from "react";
import "./ConsoleDashboard.css";
import { TraceReplayDrawer, TraceData, TraceStep } from "../components/TraceReplayDrawer";
import { apiFetch } from "../lib/api";

type DecisionStatus = "ok_to_ship" | "blocked" | "needs_review";

// Backend submission interface
interface BackendSubmission {
  submission_id: string;
  csf_type: string;
  tenant: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  title: string;
  subtitle: string;
  summary?: string;
  trace_id: string;
  payload: Record<string, unknown>;
  decision_status?: string;
  risk_level?: string;
}

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

interface WorkQueueItem {
  id: string;
  trace_id: string;
  facility: string;
  reason: string;
  age: string;
  priority: "High" | "Medium" | "Low";
  priorityColor: string;
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

// Mock trace data - 3 unique traces for work queue items
const TRACE_REPLAYS: Record<string, TraceData> = {
  "trace-2025-12-19-08-30-00-abc123": {
    trace_id: "trace-2025-12-19-08-30-00-abc123",
    tenant: "ohio-hospital-main",
    created_at: "2025-12-19 08:30:14",
    final_status: "needs_review",
    risk_level: "High",
    scenario: "Ohio Hospital – Missing TDDD license renewal",
    csf_type: "Hospital",
    total_duration_ms: 428,
    steps: [
      {
        id: "step-1",
        timestamp: "08:30:14.102",
        label: "TDDD license verification initiated",
        type: "api",
        status: "success",
        duration_ms: 12,
        details: {
          endpoint: "POST /api/license/ohio-tddd/verify",
          payload: {
            facility_id: "OH-HOSP-001",
            license_number: "TDDD-OH-12345",
          },
        },
      },
      {
        id: "step-2",
        timestamp: "08:30:14.256",
        label: "License database check",
        type: "engine",
        status: "warning",
        duration_ms: 187,
        details: {
          engine: "Ohio TDDD License Validator v2.1",
          result: "License expires 2025-12-25 - renewal documentation missing",
        },
      },
      {
        id: "step-3",
        timestamp: "08:30:14.398",
        label: "RAG query for renewal requirements",
        type: "rag",
        status: "success",
        duration_ms: 94,
        details: {
          query: "What documents are required for Ohio TDDD Category II renewal?",
          result: "Per Ohio Admin Code 4729:5-3-01, renewal requires Form TDDD-R2, current DEA registration, and facility inspection report",
        },
      },
      {
        id: "step-4",
        timestamp: "08:30:14.489",
        label: "Final decision: needs_review",
        type: "decision",
        status: "warning",
        duration_ms: 41,
        details: {
          response: {
            decision: "needs_review",
            risk: "High",
            license_expiring: true,
            renewal_docs_missing: true,
            reasons: ["License expires in 6 days", "Renewal documentation not on file", "Manual intervention required"],
          },
        },
      },
    ],
  },
  "trace-2025-12-21-14-20-00-def456": {
    trace_id: "trace-2025-12-21-14-20-00-def456",
    tenant: "ny-pharmacy-broadway",
    created_at: "2025-12-21 14:20:08",
    final_status: "needs_review",
    risk_level: "Medium",
    scenario: "NY Pharmacy – Practitioner DEA expiring soon",
    csf_type: "Practitioner",
    total_duration_ms: 312,
    steps: [
      {
        id: "step-1",
        timestamp: "14:20:08.045",
        label: "DEA registration check initiated",
        type: "api",
        status: "success",
        duration_ms: 9,
        details: {
          endpoint: "POST /api/csf/practitioner/verify-dea",
          payload: {
            practitioner_id: "PRACT-NY-5678",
            dea_number: "BP1234567",
          },
        },
      },
      {
        id: "step-2",
        timestamp: "14:20:08.178",
        label: "DEA database validation",
        type: "engine",
        status: "warning",
        duration_ms: 156,
        details: {
          engine: "DEA Registry Validator v3.0",
          result: "DEA registration valid but expires 2026-01-04 (14 days remaining)",
        },
      },
      {
        id: "step-3",
        timestamp: "14:20:08.289",
        label: "RAG query for DEA renewal process",
        type: "rag",
        status: "success",
        duration_ms: 68,
        details: {
          query: "What is the DEA renewal process for practitioners in NY?",
          result: "Per 21 CFR 1301.13, practitioners must submit DEA Form 224 renewal at least 30 days before expiration. Failure to renew results in immediate prescription authority suspension.",
        },
      },
      {
        id: "step-4",
        timestamp: "14:20:08.357",
        label: "Final decision: needs_review",
        type: "decision",
        status: "warning",
        duration_ms: 79,
        details: {
          response: {
            decision: "needs_review",
            risk: "Medium",
            dea_expiring_soon: true,
            renewal_window_active: true,
            reasons: ["DEA expires in 14 days", "No renewal submission detected", "Notify practitioner immediately"],
          },
        },
      },
    ],
  },
  "trace-2025-12-21-11-15-00-ghi789": {
    trace_id: "trace-2025-12-21-11-15-00-ghi789",
    tenant: "researcher-university-lab",
    created_at: "2025-12-21 11:15:22",
    final_status: "blocked",
    risk_level: "Medium",
    scenario: "Researcher CSF – Schedule I attestation pending",
    csf_type: "Researcher",
    total_duration_ms: 267,
    steps: [
      {
        id: "step-1",
        timestamp: "11:15:22.089",
        label: "Researcher CSF evaluation initiated",
        type: "api",
        status: "success",
        duration_ms: 11,
        details: {
          endpoint: "POST /api/csf/researcher/evaluate",
          payload: {
            researcher_id: "RES-UNI-9012",
            substance: "LSD (Schedule I)",
            quantity: 50,
            research_protocol: "PROTO-2025-045",
          },
        },
      },
      {
        id: "step-2",
        timestamp: "11:15:22.201",
        label: "Schedule I attestation check",
        type: "engine",
        status: "error",
        duration_ms: 134,
        details: {
          engine: "Researcher CSF Rules v2.8",
          result: "Supervisor attestation required for Schedule I substances - status: PENDING",
        },
      },
      {
        id: "step-3",
        timestamp: "11:15:22.298",
        label: "RAG query for attestation requirements",
        type: "rag",
        status: "success",
        duration_ms: 58,
        details: {
          query: "What are the attestation requirements for Schedule I research?",
          result: "Per 21 CFR 1301.18, Schedule I research requires written attestation from principal investigator and institutional review board approval. Attestation must be renewed annually.",
        },
      },
      {
        id: "step-4",
        timestamp: "11:15:22.356",
        label: "Final decision: blocked",
        type: "decision",
        status: "error",
        duration_ms: 64,
        details: {
          response: {
            decision: "blocked",
            risk: "Medium",
            attestation_pending: true,
            supervisor_action_required: true,
            reasons: ["Schedule I substance", "Supervisor attestation pending", "Cannot proceed until approved"],
          },
        },
      },
    ],
  },
};

// Work queue items with unique trace_ids
const WORK_QUEUE_ITEMS: WorkQueueItem[] = [
  {
    id: "WQ-001",
    trace_id: "trace-2025-12-19-08-30-00-abc123",
    facility: "Ohio Hospital – Main Campus",
    reason: "Missing TDDD license renewal documentation",
    age: "Flagged 2 days ago",
    priority: "High",
    priorityColor: "text-amber-700",
  },
  {
    id: "WQ-002",
    trace_id: "trace-2025-12-21-14-20-00-def456",
    facility: "NY Pharmacy – Broadway",
    reason: "Practitioner DEA registration expiring in 14 days",
    age: "Flagged 1 hour ago",
    priority: "Medium",
    priorityColor: "text-slate-600",
  },
  {
    id: "WQ-003",
    trace_id: "trace-2025-12-21-11-15-00-ghi789",
    facility: "Researcher CSF – University Lab",
    reason: "Schedule I attestation pending supervisor approval",
    age: "Flagged 3 hours ago",
    priority: "Low",
    priorityColor: "text-slate-600",
  },
];

const ConsoleDashboard: React.FC = () => {
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<TraceData | null>(null);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);
  const [workQueueItems, setWorkQueueItems] = useState<WorkQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTenant, setSelectedTenant] = useState("ohio");

  // Fetch work queue from backend
  useEffect(() => {
    const fetchWorkQueue = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await apiFetch<{ items: BackendSubmission[] }>(
          `/console/work-queue?status=submitted,in_review`
        );
        
        // Transform backend submissions to WorkQueueItem format
        const items: WorkQueueItem[] = data.items.map((sub: BackendSubmission) => {
          // Calculate age from created_at
          const createdDate = new Date(sub.created_at);
          const now = new Date();
          const diffMs = now.getTime() - createdDate.getTime();
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHours / 24);
          
          let age: string;
          if (diffDays > 0) {
            age = `Flagged ${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
          } else if (diffHours > 0) {
            age = `Flagged ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
          } else {
            age = `Flagged recently`;
          }
          
          // Map priority to display
          const priorityMap: Record<string, { label: string; color: string }> = {
            high: { label: "High", color: "text-amber-700" },
            medium: { label: "Medium", color: "text-slate-600" },
            low: { label: "Low", color: "text-slate-600" },
          };
          
          const priorityInfo = priorityMap[sub.priority.toLowerCase()] || { label: "Medium", color: "text-slate-600" };
          
          return {
            id: sub.submission_id,
            trace_id: sub.trace_id,
            facility: sub.title,
            reason: sub.subtitle,
            age: age,
            priority: priorityInfo.label as "High" | "Medium" | "Low",
            priorityColor: priorityInfo.color,
          };
        });
        
        setWorkQueueItems(items);
      } catch (err) {
        console.error("Failed to fetch work queue:", err);
        setError(err instanceof Error ? err.message : "Failed to load work queue");
        setWorkQueueItems([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWorkQueue();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchWorkQueue, 30000);
    return () => clearInterval(interval);
  }, [selectedTenant]);

  const handleViewTrace = async (traceId: string) => {
    setSelectedTraceId(traceId);
    setIsTraceOpen(true);
    setIsLoadingTrace(true);
    setSelectedTrace(null);

    try {
      const decisions = await apiFetch<Array<{
        trace_id: string;
        engine_family: string;
        decision_type: string;
        status: string;
        reason: string;
        risk_level?: string;
        created_at: string;
        decision: {
          status: string;
          reason: string;
          risk_level?: string;
        };
      }>>(`/decisions/trace/${traceId}`);

      if (!decisions || decisions.length === 0) {
        setError("No trace data found");
        return;
      }

      // Transform backend decision audit entries to TraceData format
      const firstDecision = decisions[0];
      const lastDecision = decisions[decisions.length - 1];
      
      const traceData: TraceData = {
        trace_id: traceId,
        tenant: "console",
        created_at: firstDecision.created_at,
        final_status: (lastDecision.status as "ok_to_ship" | "blocked" | "needs_review") || "needs_review",
        risk_level: (lastDecision.risk_level as "Low" | "Medium" | "High") || "Medium",
        scenario: `${firstDecision.decision_type} evaluation`,
        csf_type: (firstDecision.decision_type.includes("hospital") ? "Hospital" :
                   firstDecision.decision_type.includes("practitioner") ? "Practitioner" :
                   firstDecision.decision_type.includes("ems") ? "EMS" :
                   firstDecision.decision_type.includes("facility") ? "Facility" : "Researcher") as "Practitioner" | "Hospital" | "Researcher" | "Facility" | "EMS",
        total_duration_ms: 0,
        steps: decisions.map((dec, idx) => ({
          id: `step-${idx}`,
          timestamp: dec.created_at,
          label: `${dec.engine_family} - ${dec.decision_type}`,
          type: "decision" as const,
          status: (dec.status === "ok_to_ship" ? "success" : 
                   dec.status === "blocked" ? "error" : "warning") as "success" | "warning" | "error",
          details: {
            engine: dec.engine_family,
            result: dec.reason,
            response: dec.decision as unknown as Record<string, unknown>
          }
        }))
      };

      setSelectedTrace(traceData);
    } catch (err) {
      console.error("Failed to fetch trace:", err);
      setError(err instanceof Error ? err.message : "Failed to load trace");
    } finally {
      setIsLoadingTrace(false);
    }
  };

  const handleCloseTrace = () => {
    setIsTraceOpen(false);
    setSelectedTraceId(null);
    setSelectedTrace(null);
  };

  return (
    <div className="console-shell">
      <TraceReplayDrawer
        isOpen={isTraceOpen}
        onClose={handleCloseTrace}
        trace={selectedTrace}
      />
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
            <p className="mt-1 text-xs text-slate-500">
              Last updated: {new Date().toLocaleString("en-US", { 
                month: "short", 
                day: "numeric", 
                year: "numeric", 
                hour: "numeric", 
                minute: "2-digit",
                hour12: true 
              })}
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
              <button 
                className="console-ghost-button" 
                onClick={() => workQueueItems.length > 0 && handleViewTrace(workQueueItems[0].trace_id)}
                disabled={workQueueItems.length === 0}
              >
                View trace replay
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

            {/* Top drivers today */}
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700">Top drivers today</h3>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
                  Valid DEA registrations: 38
                </span>
                <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                  Missing TDDD license: 3
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  Pending attestations: 7
                </span>
                <span className="inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
                  Schedule II orders: 12
                </span>
              </div>
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

        {/* Verification work queue */}
        <section className="console-section">
          <div className="console-card">
            <div className="console-card-header">
              <div>
                <h2 className="console-card-title">Verification work queue</h2>
                <p className="console-card-subtitle">
                  Items flagged for manual review or compliance verification.
                </p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {workQueueItems.length} items
              </span>
            </div>

            <div className="space-y-3 pt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-slate-500">Loading work queue...</div>
                </div>
              ) : error && workQueueItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 max-w-md">
                    <div className="text-sm font-semibold text-red-700 mb-1">Failed to load work queue</div>
                    <div className="text-xs text-red-600">{error}</div>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                  >
                    Retry
                  </button>
                </div>
              ) : workQueueItems.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-sm text-slate-500">No items in verification queue</div>
                </div>
              ) : (
                workQueueItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-medium text-slate-900">
                        {item.facility}
                      </div>
                      <div className="text-xs text-slate-600">
                        {item.reason}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{item.age}</span>
                        <span>•</span>
                        <span className={item.priorityColor}>{item.priority} priority</span>
                      </div>
                    </div>
                    <button 
                      className="ml-4 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
                      onClick={() => handleViewTrace(item.trace_id)}
                    >
                      Open trace
                    </button>
                  </div>
                ))
              )}
            </div>
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
                        <button 
                          className="console-link-button" 
                          onClick={() => workQueueItems.length > 0 && handleViewTrace(workQueueItems[0].trace_id)}
                          disabled={workQueueItems.length === 0}
                        >
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
