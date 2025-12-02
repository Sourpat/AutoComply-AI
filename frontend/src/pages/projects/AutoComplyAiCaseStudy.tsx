import React from "react";
import {
  Brain,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  Github,
  Globe,
  Command,
  Component as ComponentIcon,
  Network,
} from "lucide-react";

type AutoComplyAiCaseStudyProps = {
  demoUrl?: string;
  repoUrl?: string;
};

const TAG_CLASS =
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border border-white/10 bg-white/5 backdrop-blur";

export default function AutoComplyAiCaseStudy({
  demoUrl,
  repoUrl,
}: AutoComplyAiCaseStudyProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute top-1/2 -left-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <main className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-12 md:gap-14 md:px-6 md:pt-16 lg:gap-16">
        {/* Hero */}
        <section className="grid gap-10 md:grid-cols-[minmax(0,1.5fr),minmax(0,1fr)] md:items-center">
          <div>
            <div className="mb-4 flex flex-wrap gap-2 text-xs text-slate-300">
              <span className={TAG_CLASS}>Personal project</span>
              <span className={TAG_CLASS}>AI + Compliance</span>
              <span className={TAG_CLASS}>FastAPI · React · RAG</span>
            </div>

            <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              AutoComply&nbsp;AI
            </h1>

            <p className="mt-4 max-w-xl text-sm text-slate-300 sm:text-base">
              A full-stack sandbox that simulates controlled-substance and
              license compliance decisions. It combines explainable AI (RAG),
              FastAPI, and a modern React UI to show how complex order approvals
              can be made transparent and developer-friendly.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {demoUrl && (
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-4 py-2 text-sm font-medium text-slate-950 shadow-sm transition hover:bg-cyan-400"
                >
                  <Globe className="h-4 w-4" />
                  View live demo
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
              {repoUrl && (
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800/80"
                >
                  <Github className="h-4 w-4" />
                  View code
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="mt-6 grid max-w-lg grid-cols-2 gap-4 text-xs text-slate-300 sm:text-sm">
              <div className="rounded-2xl border border-white/5 bg-white/5 p-3 backdrop-blur">
                <p className="font-medium text-slate-100">
                  Role & focus areas
                </p>
                <p className="mt-1 text-slate-300">
                  Product Owner · Architecture · API design · UX of sandboxes ·
                  RAG explainability.
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/5 p-3 backdrop-blur">
                <p className="font-medium text-slate-100">Tech stack</p>
                <p className="mt-1 text-slate-300">
                  FastAPI, Python, React, Vite, TypeScript, Tailwind, RAG
                  (LangChain-style), GitHub Actions, Render, Vercel.
                </p>
              </div>
            </div>
          </div>

          {/* Highlight card */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-xl shadow-black/50 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/20">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-300">
                  Core idea
                </p>
                <p className="text-sm text-slate-100">
                  Turn opaque compliance rules into explainable, testable flows.
                </p>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-300">
              <div>
                <dt className="text-slate-400">Decision model</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-50">
                  ok_to_ship / needs_review / blocked
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Flows covered</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-50">
                  CSF, Ohio TDDD, NY Pharmacy, mock orders
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">For</dt>
                <dd className="mt-1 text-sm text-slate-100">
                  Demos, interviews, portfolio storytelling
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">DX features</dt>
                <dd className="mt-1 text-sm text-slate-100">
                  Dev traces, copy-as-cURL, smoke tests
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* 3-up: Problem / Solution / How it works */}
        <section className="home-section">
          <h2 className="text-lg font-semibold text-white md:text-xl">
            From opaque approvals to explainable decisions
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-rose-500/20">
                <Activity className="h-4 w-4 text-rose-300" />
              </div>
              <h3 className="text-sm font-medium text-slate-100">Problem</h3>
              <p className="mt-2 text-xs text-slate-300 sm:text-sm">
                Controlled substances and license approvals are complex. In many
                systems, decisions live in legacy rules or spreadsheets, are
                hard to test, and impossible to explain clearly to business or
                auditors.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-500/20">
                <Brain className="h-4 w-4 text-emerald-300" />
              </div>
              <h3 className="text-sm font-medium text-slate-100">Solution</h3>
              <p className="mt-2 text-xs text-slate-300 sm:text-sm">
                AutoComply AI exposes these decisions as API-first engines with
                explainable AI copilots. Every decision is normalized to
                <code className="mx-1 rounded bg-slate-800 px-1 py-0.5">
                  ok_to_ship
                </code>
                /
                <code className="mx-1 rounded bg-slate-800 px-1 py-0.5">
                  needs_review
                </code>
                /
                <code className="mx-1 rounded bg-slate-800 px-1 py-0.5">
                  blocked
                </code>
                and backed by RAG-driven explanations.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-indigo-500/20">
                <Network className="h-4 w-4 text-indigo-300" />
              </div>
              <h3 className="text-sm font-medium text-slate-100">
                How it works
              </h3>
              <p className="mt-2 text-xs text-slate-300 sm:text-sm">
                A React frontend hosts interactive sandboxes and a Compliance
                Console. A FastAPI backend runs decision engines and AI
                copilots, and a small architecture of tests, smoke scripts, and
                dev tools keeps everything verifiable.
              </p>
            </div>
          </div>
        </section>

        {/* Key flows */}
        <section className="home-section">
          <h2 className="text-lg font-semibold text-white md:text-xl">
            Key flows you can demo
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Ohio journey */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-cyan-500/20">
                    <ShieldCheck className="h-4 w-4 text-cyan-300" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      Ohio Hospital Order Journey
                    </h3>
                    <p className="text-xs text-slate-400">
                      CSF + Ohio TDDD → final order decision.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                  From Compliance Console
                </span>
              </div>

              <ul className="mt-3 space-y-1.5 text-xs text-slate-300 sm:text-sm">
                <li>• Run 3 scenarios: happy path, missing TDDD, non-Ohio.</li>
                <li>• See normalized final decision with status badges.</li>
                <li>
                  • Open a dev trace panel with raw JSON and copy-as-cURL
                  helpers for each run.
                </li>
              </ul>
            </div>

            {/* NY license-only */}
            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-violet-500/20">
                    <ComponentIcon className="h-4 w-4 text-violet-300" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">
                      NY Pharmacy License-Only Gate
                    </h3>
                    <p className="text-xs text-slate-400">
                      Standalone license engine wired to a mock order decision.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-300">
                  From License Suite
                </span>
              </div>

              <ul className="mt-3 space-y-1.5 text-xs text-slate-300 sm:text-sm">
                <li>• Evaluate NY license payloads directly from the UI.</li>
                <li>
                  • Run a license-only order approval that uses license status
                  as the main gate.
                </li>
                <li>
                  • Show how quick it is to onboard a new license engine by
                  following the same pattern as Ohio.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Architecture + DX */}
        <section className="home-section">
          <h2 className="text-lg font-semibold text-white md:text-xl">
            Architecture & developer experience
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <h3 className="text-sm font-medium text-slate-100">
                High-level architecture
              </h3>
              <p className="mt-2 text-xs text-slate-300 sm:text-sm">
                The system is intentionally small but complete:
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-300 sm:text-sm">
                <li>
                  • <strong>Frontend</strong> (Vercel, React, Tailwind) hosts
                  CSF & License sandboxes, a Compliance Console, and status
                  badges.
                </li>
                <li>
                  • <strong>Backend</strong> (FastAPI, Render) exposes CSF
                  engines, license engines, and mock order APIs.
                </li>
                <li>
                  • <strong>AI / RAG layer</strong> powers “Form Copilots”
                  backed by regulatory docs and form content.
                </li>
                <li>
                  • <strong>Observability</strong> via a `/health` endpoint,
                  system status card, HTTP smoke tests, and dev traces.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <h3 className="flex items-center gap-2 text-sm font-medium text-slate-100">
                <Command className="h-4 w-4 text-cyan-300" />
                Built for developer workflows
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-300 sm:text-sm">
                <li>• DevSupport “Codex” commands to fix specific flows.</li>
                <li>
                  • `scripts/smoke_test_autocomply.py` to sanity-check all core
                  endpoints before a demo.
                </li>
                <li>
                  • Contract tests for CSF, License, and mock order APIs to
                  keep UI and backend aligned.
                </li>
                <li>
                  • Clear docs: architecture, compliance journey, and portfolio
                  case study under <code>docs/</code>.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Closing / What this shows about you */}
        <section className="home-section">
          <h2 className="text-lg font-semibold text-white md:text-xl">
            What this project demonstrates about my work
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <h3 className="text-sm font-medium text-slate-100">
                Product thinking
              </h3>
              <p className="mt-2 text-xs text-slate-300 sm:text-sm">
                Framed compliance as a product: clear user journeys (CSF,
                licenses, orders), explainable decisions, and a single console
                entry point that stakeholders can understand.
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <h3 className="text-sm font-medium text-slate-100">
                Systems & API design
              </h3>
              <p className="mt-2 text-xs text-slate-300 sm:text-sm">
                Normalized decision model, consistent API contracts, and
                predictable patterns for onboarding new engines (e.g., adding
                NY Pharmacy from the Ohio template).
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-900/70 p-4 backdrop-blur">
              <h3 className="text-sm font-medium text-slate-100">
                Delivery & quality
              </h3>
              <p className="mt-2 text-xs text-slate-300 sm:text-sm">
                Thought through the full lifecycle: tests, smoke checks,
                observability, developer tooling, and documentation that makes
                the project easy to demo and extend.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
