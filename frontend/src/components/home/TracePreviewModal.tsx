import React, { useState } from "react";

interface TracePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const sampleTrace = {
  trace_id: "a1b2c3d4-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
  overall_status: "ok_to_ship",
  steps: [
    {
      decision_type: "csf_hospital",
      status: "ok_to_ship",
      reason: "All required facility, pharmacy, licensing, jurisdiction, and attestation details are present. Hospital CSF is approved to proceed.",
      created_at: "2025-12-22T10:30:45.123456+00:00",
    },
    {
      decision_type: "ohio_tddd",
      status: "ok_to_ship",
      reason: "Ohio TDDD license is active and valid for Schedule II controlled substances.",
      created_at: "2025-12-22T10:30:46.234567+00:00",
    },
    {
      decision_type: "order_approval",
      status: "ok_to_ship",
      reason: "All checks passed. CSF and license validations succeeded. Order approved for shipment.",
      created_at: "2025-12-22T10:30:47.345678+00:00",
    },
  ],
};

export function TracePreviewModal({ isOpen, onClose }: TracePreviewModalProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok_to_ship":
        return "text-green-600 dark:text-green-400";
      case "blocked":
        return "text-red-600 dark:text-red-400";
      case "needs_review":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Sample Decision Trace
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Trace ID */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Trace ID
            </p>
            <p className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-900 px-3 py-2 rounded">
              {sampleTrace.trace_id}
            </p>
          </div>

          {/* Overall Status */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Overall Status
            </p>
            <p className={`text-lg font-semibold ${getStatusColor(sampleTrace.overall_status)}`}>
              {sampleTrace.overall_status}
            </p>
          </div>

          {/* Decision Steps */}
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Decision Steps ({sampleTrace.steps.length})
            </p>
            <div className="space-y-3">
              {sampleTrace.steps.map((step, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {step.decision_type}
                    </p>
                    <span className={`text-sm font-medium ${getStatusColor(step.status)}`}>
                      {step.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                    {step.reason}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(step.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Raw JSON Toggle */}
          <div>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              {showRawJson ? "Hide" : "Show"} raw JSON
            </button>
            {showRawJson && (
              <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-x-auto">
                {JSON.stringify(sampleTrace, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="ac-console__ghost-btn"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
