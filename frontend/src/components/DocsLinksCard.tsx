import React, { useState } from "react";
import { Github, FileText, BookOpen, Terminal, Copy } from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";
import { API_BASE } from "../lib/api";

type DocsLinksCardProps = {
  repoUrl?: string;
  portfolioCaseStudyPath?: string;
  architectureDocPath?: string;
};

const IconBadge = ({ label }: { label: string }) => (
  <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800 text-xs">
    {label}
  </span>
);

export function DocsLinksCard({
  repoUrl = "https://github.com/Sourpat/AutoComply-AI",
  portfolioCaseStudyPath = "docs/portfolio_case_study_autocomply_ai.md",
  architectureDocPath = "docs/system_architecture_autocomply_ai.md",
}: DocsLinksCardProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );

  const apiBaseForDocs = API_BASE || "<API_BASE_URL>";
  const localRunSnippet = `# backend
cd backend
pip install -r requirements.txt
uvicorn src.api.main:app --reload

# frontend
cd frontend
pnpm install
pnpm dev

# smoke test (backend running)
python scripts/smoke_test_autocomply.py --base-url ${apiBaseForDocs}`;

  async function handleCopyLocalRun() {
    try {
      const ok = await copyToClipboard(localRunSnippet);
      setCopyStatus(ok ? "success" : "error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200 shadow-md shadow-black/30 backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">Docs & Links</h2>
          <p className="mt-1 text-xs text-slate-400">
            Quick access to the repo, architecture, and case study when you’re demoing or explaining the system.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <IconBadge label="GH" />
            <div>
              <p className="text-xs font-medium text-slate-100">GitHub repository</p>
              <p className="text-[11px] text-slate-400">Full source code, tests, and CI workflow.</p>
            </div>
          </div>
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-300 hover:text-cyan-200"
          >
            Open repo
            <span aria-hidden>↗</span>
          </a>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <IconBadge label="SA" />
            <div>
              <p className="text-xs font-medium text-slate-100">System architecture</p>
              <p className="text-[11px] text-slate-400">Mermaid diagram + explanation of CSF, License, and Order flows.</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            In repo:{" "}
            <code className="rounded bg-slate-900/80 px-1 py-0.5">{architectureDocPath}</code>
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <IconBadge label="CS" />
            <div>
              <p className="text-xs font-medium text-slate-100">Portfolio case study</p>
              <p className="text-[11px] text-slate-400">
                Narrated story version of this project for interviews and your website.
              </p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            In repo:{" "}
            <code className="rounded bg-slate-900/80 px-1 py-0.5">{portfolioCaseStudyPath}</code>
          </p>
        </div>

        <div className="space-y-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-slate-800">
                  <Terminal className="h-3.5 w-3.5 text-amber-200" />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-100">
                    Run it locally (quick)
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Use these commands when you're setting up the demo on a new
                    machine.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyLocalRun}
                className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-medium text-slate-200 hover:border-slate-500 hover:bg-slate-800"
              >
                <Copy className="h-3 w-3" />
                {copyStatus === "success"
                  ? "Copied!"
                  : copyStatus === "error"
                  ? "Error"
                  : "Copy"}
              </button>
            </div>
            <pre className="mt-1 overflow-auto rounded-lg bg-slate-950/80 p-2 text-[10px] leading-relaxed text-slate-200">
              {localRunSnippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
