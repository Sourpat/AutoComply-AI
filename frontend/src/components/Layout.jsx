import { useState } from "react";
import { AppHeader } from "./AppHeader";
import { ApiStatusChip } from "./ApiStatusChip";
import { AppFooter } from "./AppFooter";
import { DevSupportLogPanel } from "./DevSupportLogPanel";

export default function Layout({ children }) {
  const [isDevSupportOpen, setIsDevSupportOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-[11px] text-slate-50">
      <AppHeader />

      <main className="flex-1 pt-20">
        <div className="mx-auto max-w-5xl px-6 pb-12">
          <div className="mb-4 flex items-center justify-end gap-2">
            <ApiStatusChip />

            <button
              type="button"
              onClick={() => setIsDevSupportOpen((v) => !v)}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ${
                isDevSupportOpen
                  ? "bg-slate-800 text-cyan-100 ring-cyan-500/60"
                  : "bg-slate-900 text-slate-200 ring-slate-700 hover:ring-cyan-500/60"
              }`}
            >
              DevSupport
            </button>
          </div>

          {children}
        </div>
      </main>

      <AppFooter />

      <DevSupportLogPanel
        isOpen={isDevSupportOpen}
        onClose={() => setIsDevSupportOpen(false)}
      />
    </div>
  );
}
