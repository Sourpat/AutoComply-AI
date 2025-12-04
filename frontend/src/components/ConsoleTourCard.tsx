import React from "react";
import { Activity, CheckCircle2, Globe, Sparkles } from "lucide-react";

type TourStep = {
  id: number;
  label: string;
  title: string;
  description: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    label: "CSF engines",
    title: "Start with CSF sandboxes",
    description:
      "Try Hospital, Facility, and Practitioner CSF sandboxes. Run an evaluation, then open Form Copilot to see decisions and Regulatory Insights.",
  },
  {
    id: 2,
    label: "Licenses",
    title: "Check license engines",
    description:
      "Move down to the License engines section. Explore Ohio TDDD and NY pharmacy evaluations and how they affect controlled ordering.",
  },
  {
    id: 3,
    label: "End-to-end",
    title: "Run mock order journeys",
    description:
      "Use the mock order panels (Ohio / NY) to see how CSF + license outcomes roll up into a single order decision with a developer trace.",
  },
  {
    id: 4,
    label: "Reliability",
    title: "Review health & tests",
    description:
      "Scroll to System health and Testing & reliability. Confirm health endpoints and see which pytest files back each sandbox.",
  },
  {
    id: 5,
    label: "AI / RAG",
    title: "Optional: enable AI / RAG debug",
    description:
      "Toggle AI / RAG debug in the top-right of this page to reveal raw Form Copilot payloads and license engine traces for deeper inspection.",
  },
];

export function ConsoleTourCard() {
  return (
    <section className="console-section console-section-tour">
      <div className="rounded-2xl border border-white/10 bg-slate-950/90 px-4 py-3 shadow-md shadow-black/30">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/60">
              <Globe className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-50">
                How to explore this console
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                A quick path through CSF engines, licenses, mock orders, and
                test coverage. Great for demos, interviews, or onboarding.
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-1 rounded-full bg-slate-900/90 px-2 py-1 text-[10px] text-slate-300 md:inline-flex">
            <Sparkles className="h-3 w-3 text-emerald-300" />
            <span>Guided tour</span>
          </div>
        </div>

        <ol className="mt-3 grid gap-2 md:grid-cols-2">
          {TOUR_STEPS.map((step) => (
            <li
              key={step.id}
              className="flex gap-2 rounded-xl bg-slate-900/80 px-3 py-2 ring-1 ring-white/5"
            >
              <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 text-[10px] font-medium text-slate-100 ring-1 ring-slate-600">
                {step.id <= 3 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                ) : step.id === 4 ? (
                  <Activity className="h-3.5 w-3.5 text-cyan-300" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-indigo-300" />
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  {step.label}
                </p>
                <p className="text-[11px] font-semibold text-slate-100">
                  {step.title}
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-300">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
