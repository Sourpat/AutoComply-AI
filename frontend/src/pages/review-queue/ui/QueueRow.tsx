// frontend/src/pages/review-queue/ui/QueueRow.tsx
import { ReviewQueueItemUI, RiskLevel } from "./types";

interface QueueRowProps {
  item: ReviewQueueItemUI;
  isSelected: boolean;
  onClick: () => void;
  riskLevel: RiskLevel;
}

export function QueueRow({ item, isSelected, onClick, riskLevel }: QueueRowProps) {
  const getStatusClass = (status: string) => {
    switch (status) {
      case "open":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
      case "in_review":
        return "bg-blue-500/20 text-blue-300 border-blue-500/40";
      case "published":
        return "bg-green-500/20 text-green-300 border-green-500/40";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    }
  };

  const getRiskClass = (risk: RiskLevel) => {
    switch (risk) {
      case "HIGH":
        return "bg-red-500/20 text-red-300 border-red-500/40";
      case "MEDIUM":
        return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
      case "LOW":
        return "bg-green-500/20 text-green-300 border-green-500/40";
    }
  };

  const getReasonClass = (reason: string | null) => {
    if (!reason) return "";
    switch (reason) {
      case "low_similarity":
        return "bg-orange-500/20 text-orange-300 border-orange-500/40";
      case "policy_gate":
      case "jurisdiction_mismatch":
        return "bg-red-500/20 text-red-300 border-red-500/40";
      case "no_kb_match":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-lg cursor-pointer transition-all
        ${isSelected 
          ? "bg-white/10 ring-1 ring-blue-500/50 shadow-md" 
          : "bg-slate-900/60 ring-1 ring-white/10 hover:bg-white/5 hover:ring-white/20"
        }
      `}
    >
      {/* Pills Row */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getStatusClass(item.status)}`}>
          {item.status.replace("_", " ").toUpperCase()}
        </span>
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getRiskClass(riskLevel)}`}>
          {riskLevel}
        </span>
        {item.reason_code && (
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getReasonClass(item.reason_code)}`}>
            {item.reason_code.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="text-sm font-semibold text-white mb-1 line-clamp-2">
        {item.question_text}
      </div>

      {/* Metadata */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>
          {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
        {item.top_match_score !== null && (
          <span className="text-blue-400">
            {(item.top_match_score * 100).toFixed(0)}% match
          </span>
        )}
        <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}
