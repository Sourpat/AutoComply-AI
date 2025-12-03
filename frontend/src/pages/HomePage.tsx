import React from "react";
import { Link } from "react-router-dom";
import { DocsLinksCard } from "../components/DocsLinksCard";
import { HomeDemoBanner } from "../components/HomeDemoBanner";

export function HomePage() {
  return (
    <div className="space-y-12 py-8">
      <header className="rounded-2xl bg-white/80 p-8 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              Welcome
            </p>
            <h1 className="text-3xl font-bold text-slate-900">AutoComply AI</h1>
          </div>
          <p className="max-w-3xl text-base text-slate-600">
            A sandbox for explainable controlled-substance and license
            compliance decisions, built for demos, learning, and portfolio
            storytelling.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/console"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
            >
              Open Compliance Console
            </Link>
            <Link
              to="/csf"
              className="inline-flex items-center justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-200"
            >
              Explore CSF Suite
            </Link>
            <Link
              to="/license"
              className="inline-flex items-center justify-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 hover:bg-slate-200"
            >
              Explore License Suite
            </Link>
          </div>
        </div>
      </header>

      <section>
        <HomeDemoBanner />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold text-slate-900">
            What you can do here
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                1. See the big picture
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Start with the <strong>Compliance Console</strong> to see CSF
                Suite, License Suite, and end-to-end order journeys in a single
                view. The console also includes a System Status card powered by
                the <code>/health</code> endpoint.
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              <Link to="/console" className="inline-flex items-center gap-1 text-slate-900 hover:text-slate-700">
                Go to Compliance Console →
              </Link>
            </p>
          </div>

          <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                2. Test Controlled Substance Forms (CSF)
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Use the <strong>CSF Suite</strong> sandboxes to evaluate forms for
                hospitals, facilities, practitioners, EMS, and researchers. Each
                sandbox calls a CSF decision engine and a CSF Form Copilot backed
                by RAG.
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              <Link to="/csf" className="inline-flex items-center gap-1 text-slate-900 hover:text-slate-700">
                Open CSF Suite →
              </Link>
            </p>
          </div>

          <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                3. Exercise License Engines
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Use the <strong>License Suite</strong> to test license decisions for:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>Ohio TDDD – used alongside Hospital CSF for Ohio orders.</li>
                <li>NY Pharmacy – used standalone as a license-only order gate.</li>
              </ul>
            </div>
            <p className="text-sm font-semibold text-slate-900">
              <Link to="/license" className="inline-flex items-center gap-1 text-slate-900 hover:text-slate-700">
                Open License Suite →
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-slate-900">Highlighted journeys</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Ohio Hospital Order Journey
            </h3>
            <p className="text-sm text-slate-600">
              Run three realistic scenarios from the Compliance Console:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Ohio + valid CSF + valid TDDD → <code>ok_to_ship</code>.</li>
              <li>
                Ohio + valid CSF + missing TDDD → final decision not <code>ok_to_ship</code>.
              </li>
              <li>
                Non-Ohio hospital → CSF only, no TDDD, final decision <code>ok_to_ship</code>.
              </li>
            </ul>
            <p className="text-sm text-slate-600">
              Toggle the developer trace to see raw JSON and copy requests as <code>curl</code> or JSON.
            </p>
          </div>

          <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              NY Pharmacy License-Only Gate
            </h3>
            <p className="text-sm text-slate-600">
              From the NY Pharmacy sandbox, run a license-only mock order decision that gates shipping purely based on the NY license engine:
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Happy path → license and final decision <code>ok_to_ship</code>.</li>
              <li>
                Negative path → wrong state / missing license → <code>needs_review</code> or <code>blocked</code>.
              </li>
            </ul>
            <p className="text-sm text-slate-600">
              Developer trace shows the exact request and response used for the decision, with copy-as-cURL helpers.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">For interviews and portfolio</h2>
        <p className="text-sm text-slate-600">This project is designed to be explainable end-to-end:</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Each engine has clear APIs and tests.</li>
          <li>
            Decisions are normalized to <code>ok_to_ship</code>, <code>needs_review</code>, and <code>blocked</code>.
          </li>
          <li>
            The Compliance Console and sandboxes provide live demos of CSF, licenses, and mock order approvals.
          </li>
        </ul>
        <p className="text-sm text-slate-600">
          Pair this UI with the case study and architecture docs in <code>docs/</code> when you walk someone through the system.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 md:text-xl">Resources & documentation</h2>
        <p className="mt-2 text-sm text-slate-600">
          When you’re sharing this project with someone (recruiter, hiring manager, architect), these links and docs help you
          tell the full story.
        </p>
        <div className="mt-4">
          <DocsLinksCard />
        </div>
      </section>
    </div>
  );
}
