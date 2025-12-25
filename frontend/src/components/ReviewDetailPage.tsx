// frontend/src/components/ReviewDetailPage.tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getReviewQueueItem,
  publishAnswer,
  assignReviewItem,
  type ReviewQueueItem,
} from "../api/reviewQueueClient";

export function ReviewDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const [item, setItem] = useState<ReviewQueueItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [tags, setTags] = useState("");
  const [assignee, setAssignee] = useState("");

  const loadItem = async () => {
    if (!itemId) return;
    
    setLoading(true);
    try {
      const result = await getReviewQueueItem(parseInt(itemId));
      setItem(result);
      setFinalAnswer(result.draft_answer || "");
      setTags((result.tags || []).join(", "));
      setAssignee(result.assigned_to || "");
    } catch (error) {
      console.error("Failed to load review item:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const handleAssign = async () => {
    if (!itemId || !assignee) return;
    
    try {
      await assignReviewItem(parseInt(itemId), assignee);
      await loadItem();
    } catch (error) {
      console.error("Failed to assign:", error);
      alert("Failed to assign reviewer");
    }
  };

  const handlePublish = async () => {
    if (!itemId || !finalAnswer.trim()) {
      alert("Please provide an answer to publish");
      return;
    }

    // Validate no draft markers in final answer
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
      const tagArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t);

      await publishAnswer(parseInt(itemId), finalAnswer, tagArray);
      
      alert("Answer published successfully!");
      navigate("/admin/review");
    } catch (error) {
      console.error("Failed to publish:", error);
      alert("Failed to publish answer");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 text-gray-100 p-6 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12 text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="bg-gray-900 text-gray-100 p-6 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12 text-red-400">Item not found</div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "text-yellow-400";
      case "in_review":
        return "text-blue-400";
      case "published":
        return "text-green-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <div className="bg-gray-900 text-gray-100 p-6 min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/admin/review")}
            className="text-blue-400 hover:text-blue-300 mb-4"
          >
            ← Back to Queue
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Review Item #{item.id}</h1>
              <div className="flex items-center space-x-3">
                <span className={`text-lg font-medium ${getStatusColor(item.status)}`}>
                  {item.status.replace("_", " ").toUpperCase()}
                </span>
                {item.reason_code && (
                  <span className="text-sm text-gray-400">
                    Reason: {item.reason_code.replace("_", " ")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Question Section */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-300">Question</h2>
          <div className="text-white text-lg">{item.question_text}</div>
          <div className="mt-4 flex items-center space-x-6 text-sm text-gray-400">
            <span>Created: {new Date(item.created_at).toLocaleString()}</span>
            {item.top_match_score !== null && (
              <span>
                Top KB Match: {(item.top_match_score * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Assignment Section */}
        {item.status !== "published" && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">Assignment</h2>
            <div className="flex space-x-2">
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Reviewer name or email"
                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              />
              <button
                onClick={handleAssign}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
              >
                Assign
              </button>
            </div>
            {item.assigned_to && (
              <div className="mt-2 text-sm text-gray-400">
                Currently assigned to: {item.assigned_to}
              </div>
            )}
          </div>
        )}

        {/* Draft Answer (if exists) */}
        {item.draft_answer && (
          <div className="bg-gray-800 border border-yellow-700 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3 text-yellow-400">
              AI Draft Answer
            </h2>
            <div className="text-gray-300 whitespace-pre-wrap bg-gray-900 p-4 rounded border border-gray-700">
              {item.draft_answer}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              This is an AI-generated draft. Please review and edit before publishing.
            </div>
          </div>
        )}

        {/* Answer Editor */}
        {item.status !== "published" && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3 text-gray-300">
              Final Answer
            </h2>
            <textarea
              value={finalAnswer}
              onChange={(e) => setFinalAnswer(e.target.value)}
              placeholder="Enter the final answer to publish to the knowledge base..."
              className="w-full h-48 bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white resize-y"
            />
            <div className="mt-4">
              <label className="block text-sm text-gray-400 mb-2">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., compliance, controlled-substances, florida"
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
        )}

        {/* Published Answer (if published) */}
        {item.status === "published" && item.final_answer && (
          <div className="bg-gray-800 border border-green-700 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3 text-green-400">
              Published Answer
            </h2>
            <div className="text-gray-300 whitespace-pre-wrap bg-gray-900 p-4 rounded border border-gray-700">
              {item.final_answer}
            </div>
            {item.published_kb_id && (
              <div className="mt-2 text-sm text-gray-400">
                KB Entry ID: #{item.published_kb_id}
              </div>
            )}
            {item.published_at && (
              <div className="text-sm text-gray-400">
                Published: {new Date(item.published_at).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {item.status !== "published" && (
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => navigate("/admin/review")}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || !finalAnswer.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium"
            >
              {publishing ? "Publishing..." : "Approve & Publish to KB"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
