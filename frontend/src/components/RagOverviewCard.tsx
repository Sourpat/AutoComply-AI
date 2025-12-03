import React from "react";
import { Brain, BookOpen, GitBranch } from "lucide-react";

function RagStageRow(props: {
  icon: React.ReactNode;
  title: string;
  body: string;
  hint: string;
}) {
  const { icon, title, body, hint } = props;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-slate-950/80 px-3 py-2.5">
      <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-semibold text-slate-100">{title}</p>
        <p className="text-[11px] leading-relaxed text-slate-300">{body}</p>
        <p className="text-[10px] text-slate-500">{hint}</p>
      </div>
    </div>
  );
}

export function RagOverviewCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 shadow-md shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">
            RAG &amp; Form Copilot (conceptual)
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            How document-backed reasoning is meant to plug into CSF and license
            Copilots once the RAG pipeline is fully wired.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-cyan-200 border border-cyan-500/40">
          <Brain className="h-3 w-3" />
          <span>Future-ready</span>
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        <RagStageRow
          icon={<BookOpen className="h-4 w-4 text-indigo-200" />}
          title="1. Document library & embeddings"
          body={
            "Controlled substance forms, license requirements, and internal policies are stored as versioned documents. A background job turns them into embeddings, grouped by engine family (CSF, licenses, mock orders)."
          }
          hint={
            "In a full build, this layer feeds the vector store. Updating a policy doc updates what the Copilot can cite without redeploying code."
          }
        />

        <RagStageRow
          icon={<GitBranch className="h-4 w-4 text-emerald-200" />}
          title="2. Retrieval & rule hints"
          body={
            "When you call a Form Copilot endpoint, the engine uses the form payload (state, product type, facility/practitioner details) to pull the most relevant snippets and structured rules for that scenario."
          }
          hint={
            "Think of this as a smart pre-filter: it hands the model only the slices of CSF/licensing rules that actually matter for this form."
          }
        />

        <RagStageRow
          icon={<Brain className="h-4 w-4 text-cyan-200" />}
          title="3. LLM explanation with guardrails"
          body={
            "The model turns engine outputs + retrieved snippets into a plain-language explanation: why the decision is ok_to_ship, needs_review, or blocked, which fields are missing, and which rules were referenced."
          }
          hint={
            "Responses are constrained by engine decisions: the Copilot can explain or point out gaps, but it never overrides the underlying ok_to_ship / needs_review / blocked result."
          }
        />
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        Right now the RAG fields in Copilot responses are stubbed, but the UI
        and API shapes are in place. That makes it easy to plug in a real
        vector store and retrieval layer later without rethinking the product
        story.
      </p>
    </div>
  );
}
