import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { RegulatoryKnowledgeExplorerPanel } from "../features/rag/RegulatoryKnowledgeExplorerPanel";
import { RegulatoryPreviewPanel } from "../features/rag/RegulatoryPreviewPanel";
import { RegulatoryDecisionExplainPanel } from "../features/rag/RegulatoryDecisionExplainPanel";
import "./ConsoleDashboard.css";

// Shared state for Search → Explain workflow
export interface ExplainRequest {
  decision_type: string;
  query?: string;
  source_id?: string;
  jurisdiction?: string;
  evidence?: Record<string, any>;
}

export default function RagExplorerPage() {
  const [searchParams] = useSearchParams();
  const [selectedExplainRequest, setSelectedExplainRequest] = useState<ExplainRequest | null>(null);
  const explainPanelRef = useRef<HTMLDivElement>(null);
  const submissionIdFromRoute = searchParams.get("submission_id") ?? searchParams.get("submissionId") ?? undefined;

  // Handle auto-scroll on mount if autoload=1
  useEffect(() => {
    const autoload = searchParams.get('autoload');
    if (autoload === '1') {
      setTimeout(() => {
        explainPanelRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 500);
    }
  }, [searchParams]);

  return (
    <div className="console-container">
      {/* Left Sidebar Navigation */}
      <aside className="console-sidebar">
        <div className="console-brand">
          <div className="console-brand-icon">⚖️</div>
          <div className="console-brand-text">AutoComply</div>
        </div>

        <nav className="console-nav">
          <div className="console-nav-section">Main</div>
          <a href="/console" className="console-nav-item">
            <span className="console-nav-icon">📊</span>
            <span className="console-nav-label">Dashboard</span>
          </a>
          <a href="/console/rag" className="console-nav-item console-nav-item--active">
            <span className="console-nav-icon">🔍</span>
            <span className="console-nav-label">RAG Explorer</span>
          </a>
          
          <div className="console-nav-section">Tools</div>
          <a href="/console/csf" className="console-nav-item">
            <span className="console-nav-icon">📋</span>
            <span className="console-nav-label">CSF Forms</span>
          </a>
          <a href="/console/licenses" className="console-nav-item">
            <span className="console-nav-icon">🏥</span>
            <span className="console-nav-label">Licenses</span>
          </a>
          <a href="/console/orders" className="console-nav-item">
            <span className="console-nav-icon">📦</span>
            <span className="console-nav-label">Orders</span>
          </a>
          
          <div className="console-nav-section">System</div>
          <a href="/console/settings" className="console-nav-item">
            <span className="console-nav-icon">⚙️</span>
            <span className="console-nav-label">Settings</span>
          </a>
          <a href="/console/about" className="console-nav-item">
            <span className="console-nav-icon">ℹ️</span>
            <span className="console-nav-label">About</span>
          </a>
        </nav>
      </aside>

      {/* Main content */}
      <main className="console-main">
        {/* Top header */}
        <header className="console-header">
          <div>
            <h1 className="console-page-title">Regulatory RAG Explorer</h1>
            <p className="console-page-subtitle">
              Search DEA, Ohio TDDD, and NY Pharmacy guidance to see the exact snippets behind AutoComply AI's decisions.
            </p>
          </div>
        </header>

        {/* RAG Explorer Content */}
        <div className="space-y-6 pb-8">
          {/* Helper Text */}
          <div className="rounded-lg bg-white border-2 border-slate-300 shadow-md px-5 py-4">
            <h3 className="text-base font-bold text-slate-900 mb-3">Explainability briefing</h3>
            <div className="grid gap-3 md:grid-cols-3 text-sm text-slate-800">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-900 mb-1">Submission data</div>
                <p className="text-xs text-slate-600">Facility, license IDs, expiration dates, and payload fields drive the decision input.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-900 mb-1">Policy rules</div>
                <p className="text-xs text-slate-600">Deterministic rules evaluate the submission and mark pass/fail requirements.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="font-semibold text-slate-900 mb-1">Regulatory evidence</div>
                <p className="text-xs text-slate-600">Cited snippets show the exact guidance used for each rule.</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-600">
              Use Step 1 to search the knowledge base, Step 2 to explain a decision, and Step 3 to preview source documents.
            </div>
          </div>

          <section className="console-section">
            <div className="mt-6 mb-4 flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-bold shadow-md">
                1
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Search the knowledge base
              </h2>
            </div>
            <RegulatoryKnowledgeExplorerPanel 
              onExplainRequest={(request) => {
                setSelectedExplainRequest(request);
                // Scroll to explain panel
                setTimeout(() => {
                  explainPanelRef.current?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                  });
                }, 100);
              }}
            />
          </section>

          <section className="console-section" ref={explainPanelRef}>
            <div className="mt-6 mb-4 flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-bold shadow-md">
                2
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Decision explainability (what drove the outcome)
              </h2>
            </div>
            <RegulatoryDecisionExplainPanel 
              selectedExplainRequest={selectedExplainRequest}
              onConsumed={() => setSelectedExplainRequest(null)}
              explainPanelRef={explainPanelRef}
              submissionIdFromRoute={submissionIdFromRoute}
            />
          </section>

          <section className="console-section" data-section="preview">
            <div className="mt-6 mb-4 flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white text-sm font-bold shadow-md">
                3
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Document preview
              </h2>
            </div>
            <RegulatoryPreviewPanel />
          </section>
        </div>
      </main>
    </div>
  );
}
