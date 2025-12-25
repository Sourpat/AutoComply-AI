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
      <div className="ac-console__section-header mb-6">
        <h3>Guided Demos</h3>
        <span className="ac-console__section-pill">Interactive</span>
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Explore pre-configured scenarios that demonstrate different compliance workflows. Each scenario shows the complete decision flow with expected outcomes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {demoScenarios.map((scenario, index) => (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">
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
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              {scenario.description}
            </p>
            <Link
              to={scenario.route}
              className="inline-block text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {scenario.outcome === "learning" ? "Try chatbot →" : "Run scenario →"}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
