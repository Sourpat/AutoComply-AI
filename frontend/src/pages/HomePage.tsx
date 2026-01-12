import React, { useState } from "react";
import "../styles/AutoComplyConsole.css";
import { HomeHero } from "../components/home/HomeHero";
import { GuidedDemos } from "../components/home/GuidedDemos";
import { TracePreviewModal } from "../components/home/TracePreviewModal";
import { AudiencePaths } from "../components/home/AudiencePaths";
import { MetricsStrip } from "../components/home/MetricsStrip";

export function HomePage() {
  const [isTraceModalOpen, setIsTraceModalOpen] = useState(false);

  return (
    <div className="ac-console">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        {/* Hero Section */}
        <HomeHero />

        {/* Metrics Strip */}
        <MetricsStrip backendStatus="online" />

        {/* Guided Demo Scenarios */}
        <GuidedDemos />

        {/* Trace Preview CTA */}
        <div className="ac-console__card text-center">
          <h3 className="text-xl font-semibold text-slate-900 mb-3">
            See how decisions are explained
          </h3>
          <p className="text-base text-slate-700 mb-6">
            Every decision creates an audit trail showing the complete reasoning chain.
          </p>
          <button
            onClick={() => setIsTraceModalOpen(true)}
            className="ac-console__primary-btn"
          >
            View sample decision trace
          </button>
        </div>

        {/* Audience Paths */}
        <AudiencePaths />

        {/* Trace Preview Modal */}
        <TracePreviewModal
          isOpen={isTraceModalOpen}
          onClose={() => setIsTraceModalOpen(false)}
        />
      </div>
    </div>
  );
}
