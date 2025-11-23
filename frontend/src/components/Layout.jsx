import { useState } from "react";
import { ApiStatusChip } from "./ApiStatusChip";
import { DevSupportLogPanel } from "./DevSupportLogPanel";

export default function Layout({ children }) {
  const [isDevSupportOpen, setIsDevSupportOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-[11px] text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-gray-900">
            AutoComply AI
          </span>
          <span className="text-[10px] text-gray-400">CSF + Ohio TDDD Sandbox</span>
        </div>

        <div className="flex items-center gap-2">
          <ApiStatusChip />

          <button
            type="button"
            onClick={() => setIsDevSupportOpen((v) => !v)}
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ${
              isDevSupportOpen
                ? "bg-slate-800 text-white ring-slate-800"
                : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            DevSupport
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-12">{children}</main>

      <DevSupportLogPanel
        isOpen={isDevSupportOpen}
        onClose={() => setIsDevSupportOpen(false)}
      />
    </div>
  );
}
