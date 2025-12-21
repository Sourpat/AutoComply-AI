import React from "react";
import { useNavigate } from "react-router-dom";

interface SubmitForVerificationBarProps {
  disabled: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  submissionId: string | null;
  error?: string | null;
}

export function SubmitForVerificationBar({
  disabled,
  isSubmitting,
  onSubmit,
  submissionId,
  error,
}: SubmitForVerificationBarProps) {
  const navigate = useNavigate();

  const handleViewConsole = () => {
    navigate(`/console${submissionId ? `?submission_id=${submissionId}` : ""}`);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Submit for verification</h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            Create a submission record in the Compliance Console work queue for manual review.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {submissionId && (
          <div className="rounded-lg bg-emerald-50 px-4 py-3">
            <p className="text-sm font-medium text-emerald-900">
              ✓ Submitted successfully
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Submission ID: <code className="rounded bg-emerald-100 px-1.5 py-0.5">{submissionId}</code>
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onSubmit}
            disabled={disabled || isSubmitting || !!submissionId}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : submissionId ? "Already submitted" : "Submit for verification"}
          </button>

          {submissionId && (
            <button
              onClick={handleViewConsole}
              className="rounded-lg border border-sky-600 bg-white px-4 py-2 text-sm font-semibold text-sky-600 hover:bg-sky-50"
            >
              View in Console →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
