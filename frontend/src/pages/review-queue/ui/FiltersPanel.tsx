// frontend/src/pages/review-queue/ui/FiltersPanel.tsx
interface FiltersPanelProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  reasonFilter: string;
  onReasonChange: (reason: string) => void;
  riskFilter: string;
  onRiskChange: (risk: string) => void;
  uniqueReasons: string[];
  onReset: () => void;
  stats: {
    open: number;
    in_review: number;
    published: number;
  };
}

export function FiltersPanel({
  statusFilter,
  onStatusChange,
  reasonFilter,
  onReasonChange,
  riskFilter,
  onRiskChange,
  uniqueReasons,
  onReset,
  stats,
}: FiltersPanelProps) {
  const hasFilters = reasonFilter || riskFilter;

  return (
    <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-lg p-4 shadow-sm sticky top-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Filters</h3>
        {hasFilters && (
          <button
            onClick={onReset}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Status Tabs */}
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            Status
          </label>
          <div className="space-y-1.5">
            {[
              { value: "open", label: "Open", count: stats.open },
              { value: "in_review", label: "In Review", count: stats.in_review },
              { value: "published", label: "Published", count: stats.published },
              { value: "", label: "All", count: stats.open + stats.in_review + stats.published }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => onStatusChange(option.value)}
                className={`
                  w-full text-left px-3 py-2 rounded text-sm transition-all
                  ${(option.value === "" && !statusFilter) || statusFilter === option.value
                    ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/40 font-medium"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-300"
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <span>{option.label}</span>
                  <span className="text-xs text-slate-500">{option.count}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Reason Code Dropdown */}
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            Reason Code
          </label>
          <select
            value={reasonFilter}
            onChange={(e) => onReasonChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Reasons</option>
            {uniqueReasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>

        {/* Risk Level Dropdown */}
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-slate-500 mb-2">
            Risk Level
          </label>
          <select
            value={riskFilter}
            onChange={(e) => onRiskChange(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Levels</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>
      </div>
    </div>
  );
}
