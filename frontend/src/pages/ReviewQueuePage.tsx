// frontend/src/pages/ReviewQueuePage.tsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getWorkQueue, updateSubmission, type WorkQueueSubmission } from "../api/consoleClient";

export function ReviewQueuePage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('admin_unlocked') === 'true');
  const [items, setItems] = useState<WorkQueueSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{ open: boolean; submission: WorkQueueSubmission | null }>({ 
    open: false, 
    submission: null 
  });
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch work queue items
  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const response = await getWorkQueue(undefined, "submitted,in_review", 100);
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  // Admin state sync
  useEffect(() => {
    const checkAdmin = () => {
      setIsAdmin(localStorage.getItem('admin_unlocked') === 'true');
    };
    
    window.addEventListener('storage', checkAdmin);
    const interval = setInterval(checkAdmin, 1000);
    
    return () => {
      window.removeEventListener('storage', checkAdmin);
      clearInterval(interval);
    };
  }, []);

  // Show success toast
  function showSuccess(message: string) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  }

  // Reviewer action handlers
  async function handleStartReview(submissionId: string) {
    setActionInProgress(submissionId);
    try {
      await updateSubmission(submissionId, { status: 'in_review', reviewed_by: 'admin' });
      showSuccess('Review started successfully');
      await fetchItems();
    } catch (err) {
      console.error('Failed to start review:', err);
      setError('Failed to start review');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleApprove(submissionId: string) {
    setActionInProgress(submissionId);
    try {
      await updateSubmission(submissionId, { status: 'approved', reviewed_by: 'admin' });
      showSuccess('Submission approved');
      await fetchItems();
    } catch (err) {
      console.error('Failed to approve:', err);
      setError('Failed to approve submission');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleReject(submissionId: string) {
    setActionInProgress(submissionId);
    try {
      await updateSubmission(submissionId, { status: 'rejected', reviewed_by: 'admin' });
      showSuccess('Submission rejected');
      await fetchItems();
    } catch (err) {
      console.error('Failed to reject:', err);
      setError('Failed to reject submission');
    } finally {
      setActionInProgress(null);
    }
  }

  function handleOpenNotes(submission: WorkQueueSubmission) {
    setNotesModal({ open: true, submission });
  }

  async function handleSaveNotes() {
    if (!notesModal.submission) return;
    
    setIsSaving(true);
    try {
      const notes = (document.getElementById('reviewer-notes') as HTMLTextAreaElement)?.value || '';
      await updateSubmission(notesModal.submission.submission_id, { 
        reviewer_notes: notes,
        reviewed_by: 'admin'
      });
      setNotesModal({ open: false, submission: null });
      showSuccess('Notes saved successfully');
      await fetchItems();
    } catch (err) {
      console.error('Failed to save notes:', err);
      setError('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  }

  // Format timestamp
  function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  // Get status badge color
  function getStatusColor(status: string): string {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_review':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="mt-4 text-xl font-semibold text-amber-900">Admin Mode Required</h2>
            <p className="mt-2 text-sm text-amber-700">
              You need to enable admin mode to access the Review Queue.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                to="/console"
                className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
              >
                ← Back to Console
              </Link>
              <a
                href="/console?admin=true"
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Enable Admin Mode
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Link
                to="/console"
                className="text-slate-600 hover:text-slate-900"
                title="Back to Console"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
              {isAdmin && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Admin Mode
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Review and approve CSF submissions requiring manual verification
            </p>
          </div>
          <button
            onClick={fetchItems}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Success Toast */}
        {successMessage && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-slate-900"></div>
            <p className="mt-3 text-sm text-slate-600">Loading review queue...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-900">No items in review queue</p>
            <p className="mt-1 text-sm text-slate-500">All submissions have been reviewed</p>
          </div>
        ) : (
          /* Table */
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Trace
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((item) => (
                  <tr key={item.submission_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-medium text-slate-800">
                        {item.csf_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.subtitle}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium ${getStatusColor(item.status)}`}>
                        {item.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatTimestamp(item.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.trace_id && (
                        <a
                          href={`/console?trace=${item.trace_id}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                          title="View trace"
                        >
                          Open →
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {item.status === 'submitted' && (
                          <button
                            onClick={() => handleStartReview(item.submission_id)}
                            disabled={actionInProgress === item.submission_id}
                            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {actionInProgress === item.submission_id ? 'Starting...' : 'Start Review'}
                          </button>
                        )}
                        {item.status === 'in_review' && (
                          <>
                            <button
                              onClick={() => handleApprove(item.submission_id)}
                              disabled={actionInProgress === item.submission_id}
                              className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {actionInProgress === item.submission_id ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleReject(item.submission_id)}
                              disabled={actionInProgress === item.submission_id}
                              className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              {actionInProgress === item.submission_id ? 'Rejecting...' : 'Reject'}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleOpenNotes(item)}
                          className="rounded bg-slate-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                        >
                          Notes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Item Count */}
        {!loading && items.length > 0 && (
          <div className="mt-4 text-sm text-slate-600">
            Showing {items.length} item{items.length !== 1 ? 's' : ''} awaiting review
          </div>
        )}
      </div>

      {/* Notes Modal */}
      {notesModal.open && notesModal.submission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Reviewer Notes
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {notesModal.submission.title}
            </p>
            
            {/* Show existing notes if any */}
            {notesModal.submission.reviewer_notes && (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-700">Current Notes:</p>
                <p className="mt-1 text-sm text-slate-900">{notesModal.submission.reviewer_notes}</p>
              </div>
            )}
            
            <textarea
              id="reviewer-notes"
              className="mt-4 w-full rounded-md border border-slate-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              rows={6}
              placeholder="Enter reviewer notes here..."
              defaultValue={notesModal.submission.reviewer_notes || ''}
            />
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setNotesModal({ open: false, submission: null })}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
