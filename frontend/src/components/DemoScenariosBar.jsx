import React, { useState } from "react";

/**
 * DemoScenariosBar
 *
 * A slim helper bar that surfaces ready-made JSON payloads
 * for common AutoComply AI scenarios. This is purely a UX aid
 * for demos and does not wire into the form state directly.
 *
 * It shows:
 * - a few pre-defined license scenarios (CA expired, CA near-expiry, active)
 * - a copy-to-clipboard helper for the JSON payload
 *
 * You can use these snippets in:
 * - API clients (curl / Postman)
 * - internal docs
 * - live demos when explaining the engine behaviour
 */
const DemoScenariosBar = () => {
  const [activeId, setActiveId] = useState("ca-expired");
  const [copyLabel, setCopyLabel] = useState("Copy JSON");

  const scenarios = [
    {
      id: "ca-expired",
      label: "CA – Expired license (blocked)",
      badge: "Risk demo",
      description:
        "Simulates a California state license that expired yesterday. Engine should block checkout.",
      payload: {
        practice_type: "Standard",
        state: "CA",
        state_permit: "CA-EXP-123",
        state_expiry: "2024-01-01",
        purchase_intent: "GeneralMedicalUse",
        quantity: 10,
      },
    },
    {
      id: "ca-near-expiry",
      label: "CA – Near-expiry (7 days)",
      badge: "Near-expiry",
      description:
        "Valid license expiring in 7 days. Engine allows checkout but may flag near-expiry in the verdict.",
      payload: {
        practice_type: "Standard",
        state: "CA",
        state_permit: "CA-NEAR-456",
        state_expiry: "2024-01-08",
        purchase_intent: "GeneralMedicalUse",
        quantity: 5,
      },
    },
    {
      id: "ca-active",
      label: "CA – Fully active license",
      badge: "Happy path",
      description:
        "Healthy California license with long validity and typical quantity. Good for basic success demos.",
      payload: {
        practice_type: "Standard",
        state: "CA",
        state_permit: "CA-ACTIVE-789",
        state_expiry: "2026-12-31",
        purchase_intent: "GeneralMedicalUse",
        quantity: 1,
      },
    },
  ];

  const activeScenario =
    scenarios.find((scenario) => scenario.id === activeId) || scenarios[0];

  const handleCopy = async () => {
    try {
      const json = JSON.stringify(activeScenario.payload, null, 2);
      await navigator.clipboard.writeText(json);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy JSON"), 1500);
    } catch {
      setCopyLabel("Copy failed");
      setTimeout(() => setCopyLabel("Copy JSON"), 1500);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 p-3 mb-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase">
            Demo scenarios
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Use these JSON examples when explaining how AutoComply AI evaluates
            different license states.
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          {copyLabel}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            onClick={() => setActiveId(scenario.id)}
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeId === scenario.id
                ? "border-slate-900 bg-slate-900 text-slate-50 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <span className="mr-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {scenario.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-slate-900 text-slate-50 p-3 text-[11px] font-mono leading-relaxed overflow-x-auto dark:bg-black">
        <div className="flex items-center justify-between mb-1">
          <span className="inline-flex items-center gap-1 text-slate-300">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {activeScenario.badge}
          </span>
          <span className="text-[10px] text-slate-400">
            POST /api/v1/licenses/validate/license
          </span>
        </div>
        <p className="mb-1 text-[10px] text-slate-400">
          {activeScenario.description}
        </p>
        <pre className="whitespace-pre text-[10px]">
{JSON.stringify(activeScenario.payload, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default DemoScenariosBar;
