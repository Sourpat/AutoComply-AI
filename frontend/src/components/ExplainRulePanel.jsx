import React, { useState } from "react";
import { explainRule } from "../services/api";

/**
 * ExplainRulePanel
 *
 * A small RAG-powered console that calls:
 *   POST /api/v1/licenses/explain-rule
 *
 * You can use it in demos to show how the engine
 * surfaces jurisdiction-specific regulatory context
 * for a (state, purchase_intent) pair.
 */
const ExplainRulePanel = () => {
  const [state, setState] = useState("CA");
  const [intent, setIntent] = useState("GeneralMedicalUse");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleExplain = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await explainRule({
        state,
        purchase_intent: intent,
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while fetching the explanation."
      );
    } finally {
      setLoading(false);
    }
  };

  const items = Array.isArray(result?.items) ? result.items : [];

  return (
    <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Regulatory explainer (RAG)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ask AutoComply AI to describe which rules are being considered for a
            given state and purchase intent.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          RAG demo
        </span>
      </div>

      {/* Input row */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            State / jurisdiction
          </label>
          <input
            type="text"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            placeholder="e.g. CA"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            Purchase intent
          </label>
          <input
            type="text"
            value={intent}
            onChange={(e) => setIntent(e.target.value)}
            className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            placeholder="e.g. GeneralMedicalUse"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={handleExplain}
            disabled={loading || !state || !intent}
            className={`inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors ${
              loading || !state || !intent
                ? "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed"
                : "bg-slate-900 text-slate-50 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            }`}
          >
            {loading ? "Fetching…" : "Explain rule"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-[11px] text-rose-700 dark:bg-rose-900/30 dark:text-rose-100">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !error && (
        <div className="mt-1 space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                State:{" "}
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {result.state || state}
                </span>
              </span>
              <span>
                Intent:{" "}
                <span className="font-medium text-slate-800 dark:text-slate-100">
                  {result.purchase_intent || intent}
                </span>
              </span>
            </div>
            <span>
              Sources:{" "}
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {items.length}
              </span>
            </span>
          </div>

          {items.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No regulatory snippets returned for this combination yet. Try a
              different state or intent.
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.jurisdiction && (
                        <span className="inline-flex items-center rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium text-slate-50 dark:bg-slate-100 dark:text-slate-900">
                          {item.jurisdiction}
                        </span>
                      )}
                      {item.source && (
                        <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {item.source}
                        </span>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400">
                      RAG snippet {index + 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 dark:text-slate-100">
                    {item.snippet || "[no snippet text provided]"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExplainRulePanel;
