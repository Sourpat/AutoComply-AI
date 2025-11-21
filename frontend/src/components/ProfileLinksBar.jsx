import React from "react";

const ProfileLinksBar = () => {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70">
      <div className="flex flex-col">
        <span className="text-sm font-semibold tracking-wide text-slate-600 dark:text-slate-300">
          Built by Sourabh Patil
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          DEA & state license compliance co-pilot – inspired by real
          enterprise work.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* LinkedIn CTA */}
        <a
          href="https://www.linkedin.com/in/sourabh-patil1995/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-sky-600 bg-sky-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 dark:border-sky-500 dark:bg-sky-500 dark:hover:bg-sky-600 dark:focus:ring-sky-400 dark:focus:ring-offset-slate-900"
        >
          {/* Minimal LinkedIn-style logo */}
          <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-white text-[10px] font-black text-sky-700">
            in
          </span>
          <span>Connect on LinkedIn</span>
        </a>

        {/* Portfolio CTA */}
        <a
          href="https://sourpat.github.io/sourabh-portfolio/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-white hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus:ring-slate-500 dark:focus:ring-offset-slate-900"
        >
          {/* Simple “portfolio” glyph */}
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
            <span className="inline-block align-middle">📁</span>
          </span>
          <span>View full portfolio</span>
        </a>
      </div>
    </div>
  );
};

export default ProfileLinksBar;
