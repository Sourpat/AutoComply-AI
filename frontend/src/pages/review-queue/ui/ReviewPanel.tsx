// frontend/src/pages/review-queue/ui/ReviewPanel.tsx
import { useState } from "react";
import { ReviewQueueItemUI, RiskLevel } from "./types";
import { publishAnswer } from "../../../api/reviewQueueClient";

interface ReviewPanelProps {
  item: ReviewQueueItemUI | null;
  riskLevel: RiskLevel;
  onActionComplete: () => void;
}

export function ReviewPanel({ item, riskLevel, onActionComplete }: ReviewPanelProps) {
  const [finalAnswer, setFinalAnswer] = useState("");
  const [tags, setTags] = useState("");
  const [publishing, setPublishing] = useState(false);

  if (!item) {
    return (
      <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-lg p-8 shadow-sm sticky top-4 flex items-center justify-center">
        <div className="text-center text-slate-500">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Select an item to review</p>
        </div>
      </div>
    );
  }

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

  const handlePublish = async () => {
    if (!finalAnswer.trim()) {
      alert("Please provide an answer to publish");
      return;
    }

    // Validate no draft markers
    const draftMarkers = ["DRAFT ANSWER", "REQUIRES HUMAN REVIEW", "Reviewer:", "**DRAFT**"];
    for (const marker of draftMarkers) {
      if (finalAnswer.includes(marker)) {
        alert(`Final answer contains draft marker "${marker}". Please provide a clean, user-ready answer.`);
        return;
      }
    }

    if (!confirm("Publish this answer to the knowledge base?")) {
      return;
    }

    setPublishing(true);
    try {
      const tagArray = tags.split(",").map((t) => t.trim()).filter((t) => t);
      await publishAnswer(item.id, finalAnswer, tagArray);
      alert("Answer published successfully!");
      setFinalAnswer("");
      setTags("");
      onActionComplete();
    } catch (error) {
      console.error("Failed to publish:", error);
      alert("Failed to publish answer");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-lg p-5 shadow-sm sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-slate-500 text-xs">#{item.id}</span>
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getStatusClass(item.status)}`}>
            {item.status.replace("_", " ").toUpperCase()}
          </span>
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getRiskClass(riskLevel)}`}>
            {riskLevel}
          </span>
        </div>
        <h2 className="text-lg font-semibold text-white mb-1">Review Details</h2>
        <p className="text-xs text-slate-400">
          {new Date(item.created_at).toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>

      {/* Question */}
      <div className="mb-4">
        <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Question</h3>
        <div className="bg-slate-800/60 rounded-lg p-3 text-sm text-white">
          {item.question_text}
        </div>
      </div>

      {/* Match Info */}
      {item.top_match_score !== null && (
        <div className="mb-4">
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Top Match</h3>
          <div className="bg-slate-800/60 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Similarity Score</span>
              <span className="text-sm font-medium text-blue-400">
                {(item.top_match_score * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Draft Answer */}
      {item.draft_answer && (
        <div className="mb-4">
          <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Draft Answer</h3>
          <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-300 whitespace-pre-wrap">
            {item.draft_answer}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Review and edit before publishing</p>
        </div>
      )}

      {/* Actions */}
      {item.status !== "published" && (
        <div className="space-y-4 pt-4 border-t border-slate-700/50">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-2">
              Final Answer
            </label>
            <textarea
              value={finalAnswer}
              onChange={(e) => setFinalAnswer(e.target.value)}
              placeholder="Enter the final answer to publish..."
              className="w-full h-32 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="compliance, florida, ..."
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handlePublish}
              disabled={publishing || !finalAnswer.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              {publishing ? "Publishing..." : "Approve & Publish"}
            </button>
          </div>
        </div>
      )}

      {/* Published State */}
      {item.status === "published" && (
        <div className="pt-4 border-t border-slate-700/50">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Published to KB</span>
          </div>
        </div>
      )}
    </div>
  );
}
