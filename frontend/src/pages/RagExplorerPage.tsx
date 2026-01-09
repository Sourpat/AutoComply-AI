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
            <h3 className="text-base font-bold text-slate-900 mb-3">How to use this page</h3>
            <ul className="space-y-2 text-sm text-slate-800 leading-6">
              <li className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">🔍</span>
                <span><strong>Search:</strong> Query the regulatory knowledge base to see ranked snippets</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚙️</span>
                <span><strong>Explain:</strong> Simulate CSF decisions and see which rules fired. Choose between <strong>Sandbox mode</strong> (pre-defined scenarios) or <strong>Connected mode</strong> (load from your last CSF submission)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">📄</span>
                <span><strong>Preview:</strong> View full regulatory documents stored in the knowledge base</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">💡</span>
                <span><strong>Tip:</strong> Use Jurisdiction filter to narrow results</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 mt-0.5">ℹ️</span>
                <span><strong>Note:</strong> Sandbox explorer; does not change production data</span>
              </li>
            </ul>
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
                Decision explainability (simulated scenarios)
              </h2>
            </div>
            <RegulatoryDecisionExplainPanel 
              selectedExplainRequest={selectedExplainRequest}
              onConsumed={() => setSelectedExplainRequest(null)}
              explainPanelRef={explainPanelRef}
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
