import React from "react";
import { Terminal } from "lucide-react";

type CommandBlockProps = {
  title: string;
  description: string;
  command: string;
};

function CommandBlock({ title, description, command }: CommandBlockProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/80 px-3 py-2">
      <p className="text-[11px] font-semibold text-slate-100">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{description}</p>
      <pre className="mt-1 overflow-x-auto rounded-md bg-black/70 px-2 py-1 text-[10px] text-slate-100">
        {command}
      </pre>
    </div>
  );
}

export function RunLocallyCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-100 shadow-md shadow-black/30 backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">
            Run this locally
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            Minimal commands to get AutoComply AI running on a laptop for
            demos and experimentation.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-200 border border-slate-600">
          <Terminal className="h-3 w-3" />
          <span>Dev quickstart</span>
        </span>
      </div>

      <div className="mt-3 space-y-2.5 text-[11px]">
        <p className="text-slate-300">
          From the repo root, you can spin up the backend, frontend, and
          smoke tests with just a few commands:
        </p>

        <CommandBlock
          title="1. Backend – FastAPI"
          description="Start the decision engine (CSF, licenses, mock orders) on port 8000."
          command={`cd backend\nuvicorn src.api.main:app --reload --port 8000`}
        />

        <CommandBlock
          title="2. Frontend – Vite/React"
          description="Launch the Compliance Console and sandbox UIs pointing at the local backend."
          command={`cd frontend\npnpm install\npnpm dev`}
        />

        <CommandBlock
          title="3. Sanity check – HTTP smoke tests"
          description="Ping /health, CSF, license, and mock order endpoints to confirm everything is wired."
          command={`cd backend\npython scripts/smoke_test_autocomply.py --base-url http://127.0.0.1:8000`}
        />
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        CI runs pytest + the same smoke tests on every pull request, so if it
        works here it&apos;s very likely to work in GitHub Actions as well.
      </p>
    </div>
  );
}
