import React from "react";
import { Github, FileText, BookOpen } from "lucide-react";

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 border-t border-slate-800/80 bg-slate-950/90 px-4 py-4 text-xs text-slate-400">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium text-slate-200">
            AutoComply AI
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            A demo-friendly sandbox for CSF, licenses, and mock orders — built
            to explain complex compliance flows in simple steps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href="https://github.com/Sourpat/AutoComply-AI"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-cyan-200"
            title="Open the full source code on GitHub"
          >
            <Github className="h-3.5 w-3.5" />
            <span>Repo</span>
          </a>
          <a
            href="https://github.com/Sourpat/AutoComply-AI/blob/main/docs/system_architecture_autocomply_ai.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-cyan-200"
            title="System architecture diagram and explanation"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Architecture</span>
          </a>
          <a
            href="https://github.com/Sourpat/AutoComply-AI/blob/main/docs/portfolio_case_study_autocomply_ai.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-cyan-200"
            title="Portfolio case study for interviews and your CV"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Case study</span>
          </a>
        </div>
      </div>

      <div className="mx-auto mt-3 max-w-5xl text-[10px] text-slate-500">
        © {year} AutoComply AI · Designed as a product-style sandbox for
        walkthroughs and interviews.
      </div>
    </footer>
  );
}
