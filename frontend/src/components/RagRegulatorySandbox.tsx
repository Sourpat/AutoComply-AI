// src/components/RagRegulatorySandbox.tsx
import { useState, type FormEvent } from "react";
import { callRegulatoryRag } from "../api/ragRegulatoryClient";
import {
  fetchComplianceArtifacts,
  type ComplianceArtifact,
} from "../api/complianceArtifactsClient";
import { CopyCurlButton } from "./CopyCurlButton";

type Mode = "idle" | "loading" | "done" | "error";

type RagExample = {
  id: string;
  label: string;
  question: string;
};

const RAG_EXAMPLES: RagExample[] = [
  {
    id: "fl_schedule_ii_practitioner",
    label: "FL Schedule II – Practitioner",
    question:
      "Explain why a Florida practitioner prescribing a Schedule II opioid might be flagged for manual review in the CSF workflow.",
  },
  {
    id: "hospital_vs_practitioner",
    label: "Hospital vs Practitioner CSF",
    question:
      "Compare how the practitioner CSF and hospital CSF treat controlled substances in Florida, especially for Schedule II drugs.",
  },
  {
    id: "ohio_tddd_out_of_state",
    label: "Ohio TDDD – Out-of-state shipping",
    question:
      "Explain how Ohio TDDD rules treat an account that tries to ship controlled substances into Ohio from an out-of-state facility.",
  },
  {
    id: "manual_review_playbook",
    label: "Manual review playbook",
    question:
      "Provide a concise playbook for the manual review queue when CSF submissions are flagged, focusing on what reviewers should validate.",
  },
];

export function RagRegulatorySandbox() {
  const [question, setQuestion] = useState(
    "Explain why a practitioner CSF with Florida ship-to and Schedule II items requires manual review."
  );
  const [availableArtifacts, setAvailableArtifacts] = useState<
    ComplianceArtifact[]
  >([]);
  const [selectedRefs, setSelectedRefs] = useState<string[]>([
    "csf_practitioner_form",
    "csf_fl_addendum",
  ]);
  const [decisionJson, setDecisionJson] = useState(
    JSON.stringify(
      {
        status: "manual_review",
        reason:
          "CSF includes high-risk Schedule II controlled substances for ship-to state FL.",
        missing_fields: [],
        regulatory_references: [
          "csf_practitioner_form",
          "csf_fl_addendum",
        ],
      },
      null,
      2
    )
  );

  const [mode, setMode] = useState<Mode>("idle");
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [artifactsUsed, setArtifactsUsed] = useState<string[]>([]);
  const [debug, setDebug] = useState<Record<string, unknown>>({});

  let decisionPayload: unknown = undefined;
  if (decisionJson.trim()) {
    try {
      decisionPayload = JSON.parse(decisionJson);
    } catch (err) {
      decisionPayload = undefined;
    }
  }

  const handleExampleClick = (example: RagExample) => {
    setQuestion(example.question);

    console.log("CODEX_COMMAND: rag_example_selected", {
      example_id: example.id,
      label: example.label,
      question: example.question,
    });
  };

  const loadArtifacts = async () => {
    try {
      const data = await fetchComplianceArtifacts();
      setAvailableArtifacts(data);
    } catch (err: any) {
      console.error("Failed to load compliance artifacts", err);
    }
  };

  const toggleRef = (id: string) => {
    setSelectedRefs((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setMode("loading");
    setError(null);
    setAnswer(null);
    setArtifactsUsed([]);
    setDebug({});

    let decision: unknown = undefined;
    if (decisionJson.trim()) {
      try {
        decision = JSON.parse(decisionJson);
      } catch (err: any) {
        setMode("error");
        setError(
          "Decision JSON is invalid. Please fix the JSON or clear the field."
        );
        return;
      }
    }

    try {
      const res = await callRegulatoryRag({
        question: question.trim(),
        regulatory_references: selectedRefs,
        decision,
      });

      setAnswer(res.answer);
      setArtifactsUsed(res.artifacts_used ?? []);
      setDebug(res.debug ?? {});
      setMode("done");

      console.log("CODEX_COMMAND: rag_regulatory_explain", {
        question: question.trim(),
        regulatory_references: selectedRefs,
        decision,
      });
    } catch (err: any) {
      setMode("error");
      setError(
        err?.message ??
          "Failed to call /rag/regulatory-explain. See console for details."
      );
    }
  };

  const reset = () => {
    setMode("idle");
    setError(null);
    setAnswer(null);
    setArtifactsUsed([]);
    setDebug({});
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 text-[11px] shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            RAG Regulatory Playground
          </h2>
          <p className="text-[11px] text-gray-500">
            Ask questions about a decision using regulatory artifacts. Backed by
            the /rag/regulatory-explain endpoint (stub or real RAG depending on
            environment).
          </p>
        </div>
      </header>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-700">
            Question
          </label>
          <div className="mb-2">
            <p className="text-[10px] text-gray-500">Quick examples:</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {RAG_EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                >
                  {example.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-[11px] text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[11px] font-medium text-gray-700">
              Regulatory artifacts (regulatory_references)
            </label>
            <button
              type="button"
              className="text-[10px] font-medium text-indigo-600 hover:text-indigo-800"
              onClick={loadArtifacts}
            >
              Load artifacts
            </button>
          </div>
          {availableArtifacts.length === 0 ? (
            <p className="text-[11px] text-gray-400">
              Click &ldquo;Load artifacts&rdquo; to see known coverage entries
              (CSF forms, Florida addendum, Ohio TDDD, etc.).
              <br />
              You can still type IDs manually in the code if needed:
              e.g. <code className="font-mono">csf_fl_addendum</code>,
              <code className="font-mono">ohio_tddd_registration</code>.
            </p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-1">
              {availableArtifacts.map((art) => {
                const checked = selectedRefs.includes(art.id);
                return (
                  <div
                    key={art.id}
                    className="flex items-start justify-between gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5"
                  >
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRef(art.id)}
                        className="mt-0.5 h-3 w-3"
                      />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-medium text-gray-800">
                          {art.id}
                        </span>
                        <span className="text-[10px] text-gray-500">{art.name}</span>
                        {!!art.jurisdiction && (
                          <span className="text-[10px] text-gray-400">
                            {art.jurisdiction} · {art.artifact_type}
                          </span>
                        )}
                      </div>
                    </label>

                    <div className="flex flex-col items-end gap-1">
                      {art.source_document && (
                        <a
                          href={art.source_document}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100"
                          onClick={() => {
                            console.log("CODEX_COMMAND: open_regulatory_source_document", {
                              artifact_id: art.id,
                              artifact_name: art.name,
                              url: art.source_document,
                            });
                          }}
                        >
                          View document
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-700">
            Decision JSON (optional)
          </label>
          <textarea
            value={decisionJson}
            onChange={(e) => setDecisionJson(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-gray-300 px-2 py-1 font-mono text-[10px] text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-[10px] text-gray-400">
            Paste a CSF or Ohio TDDD decision here (status, reason,
            missing_fields, regulatory_references). Leave blank to call RAG
            with only the question and artifact IDs.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={mode === "loading"}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === "loading" ? "Running RAG…" : "Run RAG explain"}
            </button>
            <CopyCurlButton
              label="Copy cURL (RAG explain)"
              endpoint="/rag/regulatory-explain"
              body={{
                question,
                regulatory_references: selectedRefs,
                decision: decisionPayload,
              }}
              disabled={!question.trim()}
              size="sm"
            />
            <button
              type="button"
              onClick={reset}
              className="text-[10px] font-medium text-gray-500 hover:text-gray-700"
            >
              Reset
            </button>
          </div>

          {mode === "loading" && (
            <span className="text-[10px] text-gray-500">
              Calling /rag/regulatory-explain…
            </span>
          )}
        </div>
      </form>

      {error && (
        <div className="mt-3 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {answer && (
        <div className="mt-3 space-y-2">
          <div>
            <h3 className="text-[11px] font-semibold text-gray-700">
              RAG Answer
            </h3>
            <pre className="mt-1 whitespace-pre-wrap rounded-md bg-gray-50 px-2 py-2 text-[11px] text-gray-800 ring-1 ring-gray-200">
              {answer}
            </pre>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-gray-700">
              Artifacts used
            </h4>
            {artifactsUsed.length === 0 ? (
              <p className="text-[11px] text-gray-400">None.</p>
            ) : (
              <ul className="mt-1 list-disc pl-4 text-[11px] text-gray-700">
                {artifactsUsed.map((id) => (
                  <li key={id}>
                    <code className="font-mono">{id}</code>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-[11px] font-semibold text-gray-700">
              Debug info
            </h4>
            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-gray-50 px-2 py-2 text-[10px] text-gray-700 ring-1 ring-gray-200">
              {JSON.stringify(debug, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
