/**
 * RecomputeModal - Modal for triggering intelligence recomputation
 * 
 * Phase 7.19: Recompute Action UX + Safety
 * 
 * Features:
 * - Required reason field
 * - Optional force refresh toggle
 * - Cooldown enforcement (30s between recomputes)
 * - Progress indicator
 * - Success/error feedback
 */

import React, { useState, useEffect } from 'react';

interface RecomputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, forceRefresh: boolean) => Promise<void>;
  lastRecomputeTime: number | null;
  cooldownSeconds?: number;
}

export const RecomputeModal: React.FC<RecomputeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  lastRecomputeTime,
  cooldownSeconds = 30,
}) => {
  const [reason, setReason] = useState('');
  const [forceRefresh, setForceRefresh] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingCooldown, setRemainingCooldown] = useState(0);

  // Calculate cooldown
  useEffect(() => {
    if (!lastRecomputeTime) {
      setRemainingCooldown(0);
      return;
    }

    const updateCooldown = () => {
      const elapsed = Math.floor((Date.now() - lastRecomputeTime) / 1000);
      const remaining = Math.max(0, cooldownSeconds - elapsed);
      setRemainingCooldown(remaining);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [lastRecomputeTime, cooldownSeconds]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason('');
      setForceRefresh(false);
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    // Validation
    if (!reason.trim()) {
      setError('Please provide a reason for recomputation');
      return;
    }

    if (remainingCooldown > 0) {
      setError(`Please wait ${remainingCooldown}s before recomputing again`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onConfirm(reason.trim(), forceRefresh);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to recompute intelligence';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const canSubmit = reason.trim().length > 0 && !submitting && remainingCooldown === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div
          className="bg-slate-900 rounded-lg shadow-xl max-w-lg w-full border border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Recompute Intelligence</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Trigger fresh computation of decision intelligence
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              disabled={submitting}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Cooldown warning */}
            {remainingCooldown > 0 && (
              <div className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="text-amber-500 text-lg">⏱️</span>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-300 mb-1">Cooldown Active</h4>
                    <p className="text-xs text-amber-200/80">
                      Please wait <span className="font-mono font-bold">{remainingCooldown}s</span> before recomputing again.
                      This prevents excessive API calls and ensures data consistency.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-lg border border-red-700/50 bg-red-950/20 px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="text-red-500 text-lg">⚠️</span>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-300 mb-1">Error</h4>
                    <p className="text-xs text-red-200/80">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reason field */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Reason for Recomputation <span className="text-red-400">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
                rows={3}
                placeholder="E.g., New evidence uploaded, Policy updated, Manual review requested..."
                disabled={submitting}
                autoFocus
              />
              <p className="text-xs text-slate-500 mt-1">
                Describe why this recomputation is needed. This will be logged in the audit trail.
              </p>
            </div>

            {/* Force refresh toggle */}
            <div className="border border-slate-700 rounded-lg p-3 bg-slate-800/50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceRefresh}
                  onChange={(e) => setForceRefresh(e.target.checked)}
                  disabled={submitting}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-700 text-sky-600 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-slate-300">Force Evidence Refresh</span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Re-analyze all evidence files and regenerate signals from scratch.
                    Use when evidence content has changed or when investigating inconsistencies.
                  </p>
                </div>
              </label>
            </div>

            {/* Info box */}
            <div className="rounded-lg border border-sky-700/50 bg-sky-950/20 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-sky-400 text-lg">ℹ️</span>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-sky-300 mb-1">What happens next?</h4>
                  <ul className="text-xs text-sky-200/80 space-y-1 list-disc list-inside">
                    <li>Fresh intelligence computation will be triggered</li>
                    <li>Confidence score will be recalculated</li>
                    <li>Gaps and bias flags will be updated</li>
                    <li>New entry will appear in confidence history</li>
                    <li>Case timeline will be updated with this action</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
            <div className="text-xs text-slate-500">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 font-mono text-[10px]">Ctrl</kbd>
              {' + '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-700 border border-slate-600 font-mono text-[10px]">Enter</kbd>
              {' to submit'}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                  canSubmit
                    ? 'bg-sky-600 text-white hover:bg-sky-700'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Recomputing...
                  </>
                ) : remainingCooldown > 0 ? (
                  <>Wait {remainingCooldown}s</>
                ) : (
                  <>
                    <span>↻</span>
                    Recompute Now
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
