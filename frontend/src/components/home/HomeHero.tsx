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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Headline + CTAs */}
        <div className="flex flex-col justify-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Automated Compliance Decisions for Controlled Substances
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
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
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            How AutoComply decides
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Input
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Submit CSF forms, license data, or order details through APIs or UI
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Decision Engine
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Rules evaluate compliance requirements and return ok_to_ship, needs_review, or blocked
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Explainable Trace
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
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
