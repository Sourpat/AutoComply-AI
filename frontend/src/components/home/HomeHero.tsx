import React from "react";
import { Link, useNavigate } from "react-router-dom";

export function HomeHero() {
  const navigate = useNavigate();

  const scrollToGuidedDemos = () => {
    const element = document.getElementById("guided-demos");
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="ac-console__card ac-console__hero">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left: Headline + CTAs */}
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight tracking-tight">
            Compliance Automation for Regulated Commerce
          </h1>
          <p className="text-xl lg:text-2xl text-slate-700 mb-8 leading-relaxed">
            Instant decisions on controlled substance forms with explainable AI and audit-ready traces.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={scrollToGuidedDemos}
              className="ac-console__primary-btn"
            >
              Start a guided demo
            </button>
            <Link to="/console" className="ac-console__ghost-btn">
              Open Compliance Console
            </Link>
          </div>
        </div>

        {/* Right: How AutoComply decides */}
        <div className="flex flex-col justify-center">
          <h3 className="text-2xl font-semibold text-slate-900 mb-8">
            How it works
          </h3>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-lg">
                1
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2 text-lg">
                  Submit
                </h4>
                <p className="text-base text-slate-700 leading-relaxed">
                  Send CSF forms, license data, or orders via API or UI
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-lg">
                2
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2 text-lg">
                  Evaluate
                </h4>
                <p className="text-base text-slate-700 leading-relaxed">
                  AI engines check compliance and return <span className="font-semibold text-slate-900">ok_to_ship</span>, <span className="font-semibold text-slate-900">needs_review</span>, or <span className="font-semibold text-slate-900">blocked</span>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-700 font-bold text-lg">
                3
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2 text-lg">
                  Audit
                </h4>
                <p className="text-base text-slate-700 leading-relaxed">
                  Every decision generates an explainable trace showing exactly why it passed or failed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
