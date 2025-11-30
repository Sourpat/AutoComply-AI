// frontend/src/pages/Home.jsx

import React, { useState } from "react";
import UploadBox from "../components/UploadBox";
import ComplianceCard from "../components/ComplianceCard";
import ManualEntryForm from "../components/ManualEntryForm";
import ScenarioLibrary from "../components/ScenarioLibrary";
import DemoScenariosBar from "../components/DemoScenariosBar";
import ExplainRulePanel from "../components/ExplainRulePanel";
import { ApiDiagnosticsPanel } from "../components/ApiDiagnosticsPanel";
import { ApiStatusChip } from "../components/ApiStatusChip";
import { DecisionHistoryPanel } from "../components/DecisionHistoryPanel";
import { OhioTdddSandbox } from "../components/OhioTdddSandbox";
import { PractitionerCsfSandbox } from "../components/PractitionerCsfSandbox";
import { FacilityCsfSandbox } from "../components/FacilityCsfSandbox";
import { HospitalCsfSandbox } from "../components/HospitalCsfSandbox";
import { ResearcherCsfSandbox } from "../components/ResearcherCsfSandbox";
import { RagRegulatorySandbox } from "../components/RagRegulatorySandbox";
import { ComplianceCoverageTable } from "../components/ComplianceCoverageTable";
import { RegulatoryFlowsPanel } from "../components/RegulatoryFlowsPanel";
import { PdmaSampleSandbox } from "../components/PdmaSampleSandbox";
import { VerificationQueuePanel } from "../components/VerificationQueuePanel";
import { ControlledSubstancesItemHistoryPanel } from "../components/ControlledSubstancesItemHistoryPanel";
import { validateLicenseJSON, explainRule } from "../services/api";

const Home = () => {
  const [result, setResult] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [errors, setErrors] = useState();
  const [isLoading, setIsLoading] = useState(false);
  const [lastScenarioId, setLastScenarioId] = useState(null);
  const [ruleExplanation, setRuleExplanation] = useState(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState(null);

  const handleResult = (data) => {
    setResult(data);
  };

  const handleManualChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormValues((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleValidatePayload = async (payload, scenarioId = null) => {
    setIsLoading(true);
    setLastScenarioId(scenarioId);
    setErrors(undefined);
    setRuleExplanation(null);
    setExplainError(null);

    try {
      const res = await validateLicenseJSON(payload);
      setResult(res);
      setErrors(res?.errors ?? undefined);
    } finally {
      setIsLoading(false);
      setLastScenarioId(null);
    }
  };

  const handleManualSubmit = async (event) => {
    event.preventDefault();
    await handleValidatePayload(formValues);
  };

  const handleRunScenarioFromLibrary = async (scenario) => {
    if (!scenario?.payload) return;
    await handleValidatePayload(scenario.payload, scenario.id || null);
  };

  const attestationCount =
    result?.verdict?.attestations_required?.length || 0;
  const hasAttestations = attestationCount > 0;
  const allowCheckout = result?.verdict?.allow_checkout;

  const handleExplainRule = async () => {
    try {
      const state = formValues.state;
      const purchaseIntent = formValues.purchase_intent;

      if (!state || !purchaseIntent) {
        setExplainError(
          "State and purchase intent are required to explain this decision."
        );
        return;
      }

      setExplainLoading(true);
      setExplainError(null);

      const payload = {
        state,
        purchase_intent: purchaseIntent,
      };

      const data = await explainRule(payload);
      setRuleExplanation(data);
    } catch (err) {
      setExplainError(err?.message || "Unable to fetch rule explanation.");
      setRuleExplanation(null);
    } finally {
      setExplainLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              AutoComply AI
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Multimodal license compliance co-pilot for regulated e-commerce
              — upload a license or enter details, and get an audit-ready
              decision with attestation support.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://www.linkedin.com/in/sourabh-patil1995/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {/* Simple LinkedIn-like icon */}
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-sky-600 text-[10px] font-bold text-white">
                in
              </span>
              <span>Connect on LinkedIn</span>
            </a>
            <a
              href="https://sourpat.github.io/sourabh-portfolio/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-50 shadow-sm hover:bg-slate-800 dark:border-slate-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {/* Simple portfolio icon */}
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-slate-400 text-[10px] font-bold">
                🗂
              </span>
              <span>View portfolio</span>
            </a>
          </div>
        </header>

        {/* Main layout */}
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          {/* Left: Input / forms */}
          <section className="space-y-4">
            <DemoScenariosBar />
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    Validate a license
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Upload a PDF license or use the manual form. AutoComply AI
                    will evaluate expiry, jurisdiction and attestation needs.
                  </p>
                </div>

                {/* Attestation chip near the form */}
                {result && allowCheckout && hasAttestations && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>
                      {attestationCount === 1
                        ? "1 attestation required"
                        : `${attestationCount} attestations required`}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <UploadBox onResult={handleResult} />
                <div className="h-px bg-slate-100 dark:bg-slate-700" />
                <ScenarioLibrary
                  onRunScenario={handleRunScenarioFromLibrary}
                  isRunning={isLoading && lastScenarioId !== null}
                />
                <ManualEntryForm
                  formValues={formValues}
                  onChange={handleManualChange}
                  onSubmit={handleManualSubmit}
                  isLoading={isLoading}
                  errors={errors}
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-500 dark:text-slate-500">
              Demo only — no real PHI/PII is stored. Use synthetic licenses and
              test data.
            </p>
          </section>

          {/* Right: Result */}
          <section>
            <ComplianceCard
              data={result}
              onExplainRule={handleExplainRule}
              ruleExplanation={ruleExplanation}
              explainLoading={explainLoading}
              explainError={explainError}
            />
            <ExplainRulePanel />
            <div className="mt-4 space-y-4">
              <ApiDiagnosticsPanel />
              <RegulatoryFlowsPanel />
              <DecisionHistoryPanel />
              <VerificationQueuePanel />
              <ControlledSubstancesItemHistoryPanel />
              <ComplianceCoverageTable />
              <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <header className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      AutoComply AI – Regulatory Sandbox
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Controlled Substances, Ohio TDDD &amp; PDMA · Engine +
                      Explain + Coverage
                    </p>
                  </div>
                  <ApiStatusChip />
                </header>

                <div className="grid gap-4 md:grid-cols-3">
                  <PractitionerCsfSandbox />
                  <HospitalCsfSandbox />
                  <FacilityCsfSandbox />
                  <ResearcherCsfSandbox />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <OhioTdddSandbox />
                  <PdmaSampleSandbox />
                  <RagRegulatorySandbox />
                </div>
              </section>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Home;
