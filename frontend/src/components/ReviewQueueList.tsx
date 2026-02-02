// frontend/src/components/ReviewQueueList.tsx
import { useState, useEffect } from "react";
import {
  getReviewQueueItems,
  type ReviewQueueItem,
  type ReviewQueueListResponse,
} from "../api/reviewQueueClient";
import { API_BASE } from "../lib/api";
import { calculateChatMetrics, inferChatRiskLevel } from "../lib/metrics";
import { ReviewQueueLayout } from "../pages/review-queue/ui/ReviewQueueLayout";
import { FiltersPanel } from "../pages/review-queue/ui/FiltersPanel";
import { QueueRow } from "../pages/review-queue/ui/QueueRow";
import { ReviewPanel } from "../pages/review-queue/ui/ReviewPanel";
import { ReviewQueueItemUI, RiskLevel } from "../pages/review-queue/ui/types";

export function ReviewQueueList() {
  const [data, setData] = useState<ReviewQueueListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [reasonFilter, setReasonFilter] = useState<string>("");
  const [riskFilter, setRiskFilter] = useState<string>("");
  const [resetting, setResetting] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const result = await getReviewQueueItems(statusFilter);
      setData(result);
    } catch (error) {
      console.error("Failed to load review queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm("Are you sure you want to reset the demo? This will delete all conversations, review items, and KB entries, then reseed with demo data.")) {
      return;
    }

    setResetting(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/demo/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Reset failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("Demo reset result:", result);
      alert(`Demo reset successful! Seeded ${result.seeded.kb_entries} KB entries.`);
      
      // Reload the queue
      await loadQueue();
    } catch (error) {
      console.error("Failed to reset demo:", error);
      alert("Failed to reset demo. Check console for details.");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [statusFilter]);

  // Auto-select first item when list changes
  useEffect(() => {
    if (data && data.items.length > 0 && !selectedItemId) {
      const filteredItems = applyFilters(data.items);
      if (filteredItems.length > 0) {
        setSelectedItemId(filteredItems[0].id);
      }
    }
  }, [data, reasonFilter, riskFilter]);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "open":
        return "bg-yellow-900 text-yellow-200 border-yellow-700";
      case "in_review":
        return "bg-blue-900 text-blue-200 border-blue-700";
      case "published":
        return "bg-green-900 text-green-200 border-green-700";
      default:
        return "bg-gray-700 text-gray-300 border-gray-600";
    }
  };

  const getReasonBadgeClass = (reason: string | null) => {
    if (!reason) return "bg-gray-700 text-gray-300";
    switch (reason) {
      case "low_similarity":
        return "bg-orange-900 text-orange-200";
      case "policy_gate":
        return "bg-red-900 text-red-200";
      case "no_kb_match":
        return "bg-purple-900 text-purple-200";
      default:
        return "bg-gray-700 text-gray-300";
    }
  };

  // Helper to apply client-side filters
  const applyFilters = (items: ReviewQueueItem[]) => {
    let filtered = items;
    if (reasonFilter) {
      filtered = filtered.filter(i => i.reason_code === reasonFilter);
    }
    if (riskFilter) {
      filtered = filtered.filter(i => inferChatRiskLevel(i.reason_code) === riskFilter);
    }
    return filtered;
  };

  // Helper to convert API item to UI item
  const toUIItem = (item: ReviewQueueItem): ReviewQueueItemUI => ({
    id: item.id,
    question_text: item.question_text,
    status: item.status,
    reason_code: item.reason_code,
    top_match_score: item.top_match_score,
    draft_answer: item.draft_answer,
    created_at: item.created_at,
    assigned_to: item.assigned_to,
  });

  return (
    <div className="bg-slate-950 text-gray-100 p-6 min-h-screen">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Chat Review Queue</h1>
            <p className="text-slate-400">
              Human-in-the-loop review for compliance Q&A. This does not include CSF or License verification artifacts.
            </p>
          </div>
          <button
            onClick={handleResetDemo}
            disabled={resetting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-medium transition-colors flex items-center space-x-2"
          >
            {resetting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Resetting...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Reset Demo</span>
              </>
            )}
          </button>
        </div>

        {/* Chat HITL KPIs */}
        {data && (() => {
          const metrics = calculateChatMetrics(data.items);
          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900/60 ring-1 ring-yellow-500/40 rounded-lg p-4">
                <div className="text-slate-400 text-sm mb-1">Open Chat Reviews</div>
                <div className="text-3xl font-bold text-yellow-400">{metrics.open_reviews}</div>
              </div>
              <div className="bg-slate-900/60 ring-1 ring-red-500/40 rounded-lg p-4">
                <div className="text-slate-400 text-sm mb-1">High Risk Open</div>
                <div className="text-3xl font-bold text-red-400">{metrics.high_risk_open_reviews}</div>
                <div className="text-xs text-slate-500 mt-1">Jurisdiction/unsafe</div>
              </div>
              <div className="bg-slate-900/60 ring-1 ring-blue-500/40 rounded-lg p-4">
                <div className="text-slate-400 text-sm mb-1">Avg Time to Response</div>
                <div className="text-3xl font-bold text-blue-400">
                  {metrics.avg_time_to_first_response_hours !== null
                    ? `${metrics.avg_time_to_first_response_hours.toFixed(1)}h`
                    : "N/A"}
                </div>
                <div className="text-xs text-slate-500 mt-1">Last 7 days</div>
              </div>
              <div className="bg-slate-900/60 ring-1 ring-green-500/40 rounded-lg p-4">
                <div className="text-slate-400 text-sm mb-1">Auto-Answered Rate</div>
                <div className="text-3xl font-bold text-green-400">
                  {metrics.auto_answered_rate !== null
                    ? `${(metrics.auto_answered_rate * 100).toFixed(1)}%`
                    : "N/A"}
                </div>
                <div className="text-xs text-slate-500 mt-1">Last 7 days</div>
              </div>
            </div>
          );
        })()}

        {/* 3-Column Layout */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-slate-400">Loading chat review queue...</div>
          </div>
        ) : !data ? (
          <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-lg p-12 text-center">
            <div className="text-slate-400 text-lg">No data available</div>
          </div>
        ) : (() => {
          const filteredItems = applyFilters(data.items);
          const uniqueReasons = [...new Set(data.items.map(i => i.reason_code))].filter((r): r is string => r !== null);
          const selectedItem = filteredItems.find(i => i.id === selectedItemId);
          const selectedRisk: RiskLevel = selectedItem 
            ? inferChatRiskLevel(selectedItem.reason_code) as RiskLevel
            : "LOW";

          if (filteredItems.length === 0) {
            return (
              <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-lg p-12 text-center">
                {statusFilter === "open" ? (
                  <div className="max-w-md mx-auto">
                    <div className="text-slate-400 text-lg mb-3">✨ No open items</div>
                    <div className="text-slate-500 text-sm mb-4">
                      Great! All questions have been reviewed. 
                      {data.stats.published > 0 && (
                        <> {data.stats.published} published items in the knowledge base.</>
                      )}
                    </div>
                    <div className="bg-slate-900 ring-1 ring-slate-600 rounded-lg p-4 mb-4">
                      <p className="text-slate-400 text-sm mb-2">💡 Want to see the queue in action?</p>
                      <p className="text-slate-500 text-xs">
                        Go to <span className="text-blue-400 font-mono">/chat</span> and ask an unknown question.
                        It will appear here for review.
                      </p>
                    </div>
                    {data.stats.published > 0 && (
                      <button
                        onClick={() => setStatusFilter("published")}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        View Published Items →
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="text-slate-400 text-lg">No {statusFilter.replace("_", " ")} items</div>
                    <div className="text-slate-500 text-sm mt-2">
                      Try a different filter or check back later
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
            <ReviewQueueLayout
              filters={
                <FiltersPanel
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  reasonFilter={reasonFilter}
                  onReasonChange={setReasonFilter}
                  riskFilter={riskFilter}
                  onRiskChange={setRiskFilter}
                  stats={{
                    open: data.stats.open,
                    in_review: data.stats.in_review,
                    published: data.stats.published,
                  }}
                  uniqueReasons={uniqueReasons}
                  onReset={() => {
                    setReasonFilter("");
                    setRiskFilter("");
                  }}
                />
              }
              list={
                <div className="bg-slate-900/60 ring-1 ring-white/10 rounded-lg shadow-sm overflow-hidden">
                  <div className="divide-y divide-slate-800">
                    {filteredItems.map((item) => {
                      const riskLevel = inferChatRiskLevel(item.reason_code) as RiskLevel;
                      return (
                        <QueueRow
                          key={item.id}
                          item={toUIItem(item)}
                          riskLevel={riskLevel}
                          isSelected={item.id === selectedItemId}
                          onClick={() => setSelectedItemId(item.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              }
              panel={
                <ReviewPanel
                  item={selectedItem ? toUIItem(selectedItem) : null}
                  riskLevel={selectedRisk}
                  onActionComplete={loadQueue}
                />
              }
            />
          );
        })()}
      </div>
    </div>
  );
}
