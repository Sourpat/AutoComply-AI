// frontend/src/components/CsfWorkQueue.tsx
import React, { useEffect, useState } from "react";
import {
  getWorkQueue,
  updateSubmission,
  type WorkQueueSubmission,
} from "../api/consoleClient";

interface CsfWorkQueueProps {
  className?: string;
}

export function CsfWorkQueue({ className }: CsfWorkQueueProps) {
  const [submissions, setSubmissions] = useState<WorkQueueSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{
    submission: WorkQueueSubmission;
    notes: string;
  } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  
  // Status filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Check if user is admin (using existing admin unlock mechanism)
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('admin_unlocked') === 'true';
  });

  // Listen for storage changes (when admin mode changes)
  useEffect(() => {
    const handleStorageChange = () => {
      setIsAdmin(localStorage.getItem('admin_unlocked') === 'true');
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check on mount and periodically
    const interval = setInterval(() => {
      const currentAdminState = localStorage.getItem('admin_unlocked') === 'true';
      if (currentAdminState !== isAdmin) {
        setIsAdmin(currentAdminState);
      }
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isAdmin]);

  async function fetchSubmissions() {
    setLoading(true);
    setError(null);

    try {
      const resp = await getWorkQueue(undefined, undefined, 100);
      setSubmissions(resp.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load work queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSubmissions();
  }, []);

  async function handleStatusUpdate(
    submissionId: string,
    status: "in_review" | "approved" | "rejected"
  ) {
    setUpdating(submissionId);
    try {
      await updateSubmission(submissionId, { status });
      await fetchSubmissions(); // Refresh the queue
    } catch (err) {
      alert(`Failed to update status: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUpdating(null);
    }
  }

  async function handleSaveNotes() {
    if (!notesModal) return;

    setUpdating(notesModal.submission.submission_id);
    try {
      await updateSubmission(notesModal.submission.submission_id, {
        reviewer_notes: notesModal.notes,
      });
      await fetchSubmissions(); // Refresh
      setNotesModal(null);
    } catch (err) {
      alert(`Failed to save notes: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUpdating(null);
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "submitted":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "in_review":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  function getDecisionStatusColor(status: string | null): string {
    switch (status) {
      case "ok_to_ship":
        return "bg-green-100 text-green-800 border-green-200";
      case "blocked":
        return "bg-red-100 text-red-800 border-red-200";
      case "needs_review":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  }

  // Calculate statistics
  const stats = {
    total: submissions.length,
    submitted: submissions.filter((s) => s.status === "submitted").length,
    in_review: submissions.filter((s) => s.status === "in_review").length,
    approved: submissions.filter((s) => s.status === "approved").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
  };
  
  // Filter submissions based on status filter
  const filteredSubmissions = statusFilter === 'all'
    ? submissions
    : submissions.filter((s) => s.status === statusFilter);

  if (loading) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">Loading work queue...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            CSF Verification Work Queue
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Review and manage CSF submissions awaiting verification
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-5 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-600">Total</div>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-2xl font-bold text-blue-900">{stats.submitted}</div>
            <div className="text-xs text-blue-700">Submitted</div>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
            <div className="text-2xl font-bold text-purple-900">{stats.in_review}</div>
            <div className="text-xs text-purple-700">In Review</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="text-2xl font-bold text-green-900">{stats.approved}</div>
            <div className="text-xs text-green-700">Approved</div>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <div className="text-2xl font-bold text-red-900">{stats.rejected}</div>
            <div className="text-xs text-red-700">Rejected</div>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Filter:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              statusFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setStatusFilter('submitted')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              statusFilter === 'submitted'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
            }`}
          >
            Submitted ({stats.submitted})
          </button>
          <button
            onClick={() => setStatusFilter('in_review')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              statusFilter === 'in_review'
                ? 'bg-purple-600 text-white'
                : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
            }`}
          >
            In Review ({stats.in_review})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              statusFilter === 'approved'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-800 hover:bg-green-200'
            }`}
          >
            Approved ({stats.approved})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              statusFilter === 'rejected'
                ? 'bg-red-600 text-white'
                : 'bg-red-100 text-red-800 hover:bg-red-200'
            }`}
          >
            Rejected ({stats.rejected})
          </button>
          
          {!isAdmin && (
            <div className="ml-auto text-xs text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              ⚠️ Read-only (Admin unlock required)
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Decision
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Title
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Created
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-sm text-slate-500">
                    {statusFilter === 'all' ? 'No submissions in queue' : `No ${statusFilter} submissions`}
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.submission_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${getStatusColor(
                          sub.status
                        )}`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 font-medium ${getDecisionStatusColor(
                          sub.decision_status
                        )}`}
                      >
                        {sub.decision_status || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-900">
                      <div className="max-w-xs">
                        <div className="font-medium">{sub.title}</div>
                        <div className="text-slate-600">{sub.subtitle}</div>
                        {sub.reviewer_notes && (
                          <div className="mt-1 text-xs italic text-slate-500">
                            Notes: {sub.reviewer_notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {sub.csf_type}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <div className="flex gap-2">
                        {isAdmin ? (
                          <>
                            {sub.status === "submitted" && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(sub.submission_id, "in_review")
                                }
                                disabled={updating === sub.submission_id}
                                className="rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                              >
                                Start Review
                              </button>
                            )}
                            {sub.status === "in_review" && (
                              <>
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(sub.submission_id, "approved")
                                  }
                                  disabled={updating === sub.submission_id}
                                  className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(sub.submission_id, "rejected")
                                  }
                                  disabled={updating === sub.submission_id}
                                  className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() =>
                                setNotesModal({
                                  submission: sub,
                                  notes: sub.reviewer_notes || "",
                            })
                          }
                          className="rounded bg-slate-600 px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
                        >
                          {isAdmin ? 'Notes' : 'View Notes'}
                        </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Admin access required</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes Modal */}
      {notesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {isAdmin ? 'Reviewer Notes' : 'View Reviewer Notes'}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{notesModal.submission.title}</p>

            <textarea
              className="mt-4 w-full rounded-md border border-slate-300 p-3 text-sm"
              rows={6}
              value={notesModal.notes}
              onChange={(e) =>
                setNotesModal({ ...notesModal, notes: e.target.value })
              }
              placeholder={isAdmin ? "Add notes about this review..." : "No notes available"}
              disabled={!isAdmin}
            />

            {!isAdmin && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠️ Admin access required to edit notes
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setNotesModal(null)}
                className="rounded bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300"
              >
                {isAdmin ? 'Cancel' : 'Close'}
              </button>
              {isAdmin && (
                <button
                  onClick={handleSaveNotes}
                  disabled={updating === notesModal.submission.submission_id}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Save Notes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
