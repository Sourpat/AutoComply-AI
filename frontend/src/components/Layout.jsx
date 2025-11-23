import { ApiStatusChip } from "./ApiStatusChip";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-[11px] text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-gray-900">
            AutoComply AI
          </span>
          <span className="text-[10px] text-gray-400">CSF + Ohio TDDD Sandbox</span>
        </div>

        <ApiStatusChip />
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-12">{children}</main>
    </div>
  );
}
