import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Command, Info } from "lucide-react";

type Step = {
  id: number;
  title: string;
  description: string;
  tooltip: string;
  to: string;
};

const STEPS: Step[] = [
  {
    id: 1,
    title: "Open the CSF Suite",
    description:
      "Start with a controlled substance form sandbox to show how decisions are made from real-world forms.",
    tooltip:
      "In an interview: explain that CSF engines are API-first and normalize to ok_to_ship / needs_review / blocked, no matter which form type you start from.",
    to: "/csf",
  },
  {
    id: 2,
    title: "Explore the License Suite",
    description:
      "Show Ohio TDDD and NY Pharmacy licenses as separate engines that still speak the same decision language.",
    tooltip:
      "Call out that each license engine has its own payload and state rules, but shares one decision model. That’s what makes the system easy to extend to new states.",
    to: "/license",
  },
  {
    id: 3,
    title: "Run the Ohio Hospital order journey",
    description:
      "Use the Ohio journey card to run Happy path, Missing TDDD, and Non-Ohio scenarios side by side.",
    tooltip:
      "Narrate how the system combines CSF + Ohio TDDD license into a single mock order decision, with scenario chips that flip between outcomes in one click.",
    to: "/console",
  },
  {
    id: 4,
    title: "Open a dev trace and docs",
    description:
      "Turn on the developer trace and use the Docs & Links card to show APIs, architecture, and smoke tests.",
    tooltip:
      "This is your chance to prove engineering empathy: show the raw JSON, copy-as-cURL helpers, and explain how tests + smoke scripts keep everything honest.",
    to: "/console",
  },
];

function StepTooltip({ text }: { text: string }) {
  return (
    <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-700/70 bg-slate-900/95 p-3 text-[11px] text-slate-200 shadow-lg shadow-black/40">
      <p className="text-[11px] leading-relaxed">{text}</p>
    </div>
  );
}

export function HomeNextSteps() {
  const [openStepId, setOpenStepId] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 shadow-md shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">
            Next steps for a 2–3 minute demo
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            Follow these steps when you're walking someone through AutoComply
            AI. Each step has a quick hint on what to say.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-300">
          <Command className="h-3 w-3" />
          Guided flow
        </span>
      </div>

      <ol className="mt-3 space-y-2">
        {STEPS.map((step) => {
          const isOpen = openStepId === step.id;
          return (
            <li
              key={step.id}
              className="relative rounded-xl border border-white/5 bg-slate-950/80 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-200">
                      {step.id}
                    </span>
                    <p className="text-xs font-medium text-slate-100">
                      {step.title}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300">
                    {step.description}
                  </p>
                  <Link
                    to={step.to}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
                  >
                    Go to this part of the app
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenStepId((prev) => (prev === step.id ? null : step.id))
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800"
                  >
                    <Info className="h-3 w-3 text-cyan-300" />
                    <span>What to say</span>
                  </button>
                  {isOpen && <StepTooltip text={step.tooltip} />}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-[11px] text-slate-400">
        Tip: run through this once yourself and adjust the wording so it
        sounds like you. The structure stays the same, but the story becomes
        yours.
      </p>
    </div>
  );
}
