import React from "react";
import { Link } from "react-router-dom";

interface GuidedDemoCard {
  title: string;
  description: string;
  outcome: "ok_to_ship" | "blocked" | "learning";
  route: string;
  badge?: string;
}

const demoScenarios: GuidedDemoCard[] = [
  {
    title: "🆕 Learn After First Unknown",
    description: "Ask questions to the AI chatbot. Unknown questions go to human review and build the knowledge base.",
    outcome: "learning",
    route: "/chat",
    badge: "NEW",
  },
  {
    title: "Hospital CSF Journey",
    description: "Complete hospital pharmacy controlled substance form with valid license and attestation",
    outcome: "ok_to_ship",
    route: "/csf/hospital",
  },
  {
    title: "EMS CSF Journey",
    description: "Emergency medical services CSF evaluation with proper credentials and jurisdiction",
    outcome: "ok_to_ship",
    route: "/csf/ems",
  },
  {
    title: "Researcher CSF Journey",
    description: "Research facility controlled substance form with valid pharmacy license",
    outcome: "ok_to_ship",
    route: "/csf/researcher",
  },
  {
    title: "Blocked Scenario",
    description: "Ohio hospital order with expired TDDD license showing blocked decision flow",
    outcome: "blocked",
    route: "/console",
  },
];

export function GuidedDemos() {
  const getOutcomeBadgeClass = (outcome: string) => {
    if (outcome === "ok_to_ship") {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    }
    if (outcome === "learning") {
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    }
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
  };

  return (
    <section id="guided-demos" className="ac-console__card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Guided Demos</h2>
        <span className="px-4 py-2 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-sm font-semibold">Interactive</span>
      </div>

      <p className="text-lg text-slate-700 dark:text-gray-300 mb-8 leading-relaxed">
        Explore pre-configured scenarios that demonstrate different compliance workflows. Each scenario shows the complete decision flow with expected outcomes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {demoScenarios.map((scenario, index) => (
          <div
            key={index}
            className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:shadow-xl hover:border-cyan-300 dark:hover:border-cyan-700 transition-all bg-white dark:bg-slate-800"
          >
            <div className="flex items-start justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                {scenario.title}
              </h4>
              <div className="flex items-center space-x-2">
                {scenario.badge && (
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {scenario.badge}
                  </span>
                )}
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${getOutcomeBadgeClass(
                    scenario.outcome
                  )}`}
                >
                  {scenario.outcome === "learning" ? "AI + Human" : scenario.outcome}
                </span>
              </div>
            </div>
            <p className="text-base text-slate-700 dark:text-gray-300 mb-5 leading-relaxed">
              {scenario.description}
            </p>
            <Link
              to={scenario.route}
              className="inline-flex items-center text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
            >
              {scenario.outcome === "learning" ? "Try chatbot →" : "Run scenario →"}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
