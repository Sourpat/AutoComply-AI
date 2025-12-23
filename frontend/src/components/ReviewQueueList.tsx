// frontend/src/components/ReviewQueueList.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getReviewQueueItems,
  type ReviewQueueItem,
  type ReviewQueueListResponse,
} from "../api/reviewQueueClient";

export function ReviewQueueList() {
  const navigate = useNavigate();
  const [data, setData] = useState<ReviewQueueListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");

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

  useEffect(() => {
    loadQueue();
  }, [statusFilter]);

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

  return (
    <div className="bg-gray-900 text-gray-100 p-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Review Queue</h1>
          <p className="text-gray-400">
            Manage questions that need human review before being added to the knowledge base
          </p>
        </div>

        {/* Stats Summary */}
        {data && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Total Items</div>
              <div className="text-2xl font-bold">{data.stats.total}</div>
            </div>
            <div className="bg-gray-800 border border-yellow-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Open</div>
              <div className="text-2xl font-bold text-yellow-400">{data.stats.open}</div>
            </div>
            <div className="bg-gray-800 border border-blue-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">In Review</div>
              <div className="text-2xl font-bold text-blue-400">{data.stats.in_review}</div>
            </div>
            <div className="bg-gray-800 border border-green-700 rounded-lg p-4">
              <div className="text-gray-400 text-sm">Published</div>
              <div className="text-2xl font-bold text-green-400">{data.stats.published}</div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex space-x-2 mb-6">
          {["open", "in_review", "published", "all"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status === "all" ? "" : status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                (status === "all" && !statusFilter) || statusFilter === status
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {status.replace("_", " ").toUpperCase()}
            </button>
          ))}
        </div>

        {/* Items List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading review queue...</div>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
            <div className="text-gray-400 text-lg">No items in queue</div>
            <div className="text-gray-500 text-sm mt-2">
              Questions needing review will appear here
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/admin/review/${item.id}`)}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-blue-500 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-gray-500 text-sm">#{item.id}</span>
                      <span
                        className={`px-2 py-1 text-xs rounded border ${getStatusBadgeClass(
                          item.status
                        )}`}
                      >
                        {item.status.replace("_", " ").toUpperCase()}
                      </span>
                      {item.reason_code && (
                        <span
                          className={`px-2 py-1 text-xs rounded ${getReasonBadgeClass(
                            item.reason_code
                          )}`}
                        >
                          {item.reason_code.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <div className="text-white font-medium mb-1">
                      {item.question_text}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span>
                        Created: {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      {item.assigned_to && (
                        <span>Assigned to: {item.assigned_to}</span>
                      )}
                      {item.top_match_score !== null && (
                        <span>
                          Top Match: {(item.top_match_score * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-blue-400">→</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
