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
          <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
            Automated Compliance Decisions for Controlled Substances
          </h1>
          <p className="text-xl text-slate-700 dark:text-gray-300 mb-8 leading-relaxed">
            Evaluate CSFs, licenses, and orders with explainable decisions and audit-ready traces.
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
          <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-8">
            How AutoComply decides
          </h3>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center text-cyan-700 dark:text-cyan-300 font-bold text-lg">
                1
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">
                  Input
                </h4>
                <p className="text-base text-slate-700 dark:text-gray-300 leading-relaxed">
                  Submit CSF forms, license data, or order details through APIs or UI
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center text-cyan-700 dark:text-cyan-300 font-bold text-lg">
                2
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">
                  Decision Engine
                </h4>
                <p className="text-base text-slate-700 dark:text-gray-300 leading-relaxed">
                  Rules evaluate compliance requirements and return ok_to_ship, needs_review, or blocked
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-cyan-100 dark:bg-cyan-900 flex items-center justify-center text-cyan-700 dark:text-cyan-300 font-bold text-lg">
                3
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">
                  Explainable Trace
                </h4>
                <p className="text-base text-slate-700 dark:text-gray-300 leading-relaxed">
                  Every decision creates an audit trail showing why each step passed or failed
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
