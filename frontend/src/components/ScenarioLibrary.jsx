// frontend/src/components/ScenarioLibrary.jsx

import React from "react";

/**
 * ScenarioLibrary
 *
 * Small helper panel to quickly run canonical CA/NY/DEA-style scenarios
 * without manually typing every field. This is purely a UX helper – the
 * backend still uses the same /validate/license endpoint and rules.
 *
 * Props:
 * - onRunScenario: (scenario) => void | Promise<void>
 *      Called when a scenario is selected. Receives the full scenario object:
 *      {
 *        id: string;
 *        label: string;
 *        description: string;
 *        payload: LicenseValidationRequest-like JSON
 *      }
 * - isRunning: boolean (optional)
 *      When true, buttons show a subtle "running..." state.
 */

const SCENARIOS = [
  {
    id: "ca_general_medical",
    label: "CA – General medical use (valid 1 year)",
    description:
      "Standard California office with a clean, long-dated state permit. Should be allowed for checkout.",
    payload: {
      practice_type: "Standard",
      state: "CA",
      state_permit: "C987654",
      state_expiry: "2028-08-15",
      purchase_intent: "GeneralMedicalUse",
      quantity: 10,
    },
  },
  {
    id: "ca_telemedicine_attestation",
    label: "CA – Telemedicine sale (attestation expected)",
    description:
      "Telemedicine-type intent that should still be allowed but often requires an extra attestation (Ryan Haight-like).",
    payload: {
      practice_type: "Telemedicine",
      state: "CA",
      state_permit: "C555555",
      state_expiry: "2027-12-31",
      purchase_intent: "TelemedicineUse",
      quantity: 5,
    },
  },
  {
    id: "ny_tight_rules",
    label: "NY – Stricter state behaviour (demo)",
    description:
      "New York example to demonstrate state-specific rules and different messaging in the regulatory context.",
    payload: {
      practice_type: "Standard",
      state: "NY",
      state_permit: "NY-12345",
      state_expiry: "2027-06-30",
      purchase_intent: "GeneralMedicalUse",
      quantity: 8,
    },
  },
];

const ScenarioLibrary = ({ onRunScenario, isRunning = false }) => {
  const handleClick = (scenario) => {
    if (!onRunScenario) return;
    onRunScenario(scenario);
  };

  return (
    <section className="w-full rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Scenario Library (CA / NY / Telemedicine)
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            One-click test flows using realistic payloads – useful for demos and
            quick regression checks without re-typing forms.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-50 dark:bg-slate-100 dark:text-slate-900">
          Demo helper
        </span>
      </header>

      <ul className="space-y-2">
        {SCENARIOS.map((scenario) => (
          <li
            key={scenario.id}
            className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-slate-700 dark:bg-slate-800/80"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-50">
                  {scenario.label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                  {scenario.description}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleClick(scenario)}
                className="inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold text-slate-50 shadow-sm transition-colors bg-slate-900 hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                disabled={isRunning}
              >
                {isRunning ? "Running…" : "Run scenario"}
              </button>
              <details className="text-[10px] text-slate-500 dark:text-slate-400">
                <summary className="cursor-pointer select-none text-[10px] font-medium underline-offset-2 hover:underline">
                  View JSON payload
                </summary>
                <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-slate-900/90 p-2 text-[9px] leading-snug text-slate-100">
                  {JSON.stringify(scenario.payload, null, 2)}
                </pre>
              </details>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ScenarioLibrary;
