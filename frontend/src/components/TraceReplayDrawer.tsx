import React, { useState } from "react";

export interface TraceStep {
  id: string;
  timestamp: string;
  label: string;
  type: "engine" | "rag" | "decision" | "api";
  status: "success" | "warning" | "error";
  duration_ms?: number;
  details?: {
    endpoint?: string;
    engine?: string;
    query?: string;
    result?: string;
    payload?: Record<string, unknown>;
    response?: Record<string, unknown>;
  };
}

export interface TraceData {
  trace_id: string;
  tenant: string;
  created_at: string;
  final_status: "ok_to_ship" | "blocked" | "needs_review";
  risk_level: "Low" | "Medium" | "High";
  scenario: string;
  csf_type: "Practitioner" | "Hospital" | "Researcher" | "Facility" | "EMS";
  total_duration_ms: number;
  steps: TraceStep[];
}

interface TraceReplayDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  trace: TraceData | null;
}

export function TraceReplayDrawer({ isOpen, onClose, trace }: TraceReplayDrawerProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  if (!isOpen || !trace) return null;

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok_to_ship":
        return "text-emerald-700 bg-emerald-100";
      case "blocked":
        return "text-red-700 bg-red-100";
      case "needs_review":
        return "text-amber-700 bg-amber-100";
      default:
        return "text-slate-700 bg-slate-100";
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "Low":
        return "text-emerald-700 bg-emerald-100";
      case "Medium":
        return "text-amber-700 bg-amber-100";
      case "High":
        return "text-red-700 bg-red-100";
      default:
        return "text-slate-700 bg-slate-100";
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return "✓";
      case "warning":
        return "⚠";
      case "error":
        return "✕";
      default:
        return "•";
    }
  };

  const getStepStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-emerald-500";
      case "warning":
        return "bg-amber-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-slate-400";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "engine":
        return "Decision Engine";
      case "rag":
        return "RAG Query";
      case "decision":
        return "Final Decision";
      case "api":
        return "API Call";
      default:
        return type;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-slate-900">Trace replay</h2>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700">
                  {trace.trace_id}
                </code>
                <button
                  onClick={() => copyToClipboard(trace.trace_id)}
                  className="text-xs text-sky-600 hover:text-sky-700"
                  title="Copy trace ID"
                >
                  Copy
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title="Close (ESC)"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Metadata */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">Status</div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(trace.final_status)}`}>
                {trace.final_status === "ok_to_ship" ? "OK to ship" : trace.final_status === "blocked" ? "Blocked" : "Needs review"}
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">Risk Level</div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getRiskColor(trace.risk_level)}`}>
                {trace.risk_level}
              </span>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">Scenario</div>
              <div className="text-sm text-slate-900">{trace.scenario}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">CSF Type</div>
              <div className="text-sm text-slate-900">{trace.csf_type}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">Timestamp</div>
              <div className="text-sm text-slate-900">{trace.created_at}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-500">Total Duration</div>
              <div className="text-sm text-slate-900">{trace.total_duration_ms}ms</div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="px-6 py-6">
          <h3 className="mb-4 text-sm font-semibold text-slate-900">Execution timeline</h3>
          <div className="space-y-3">
            {trace.steps.map((step, index) => {
              const isExpanded = expandedSteps.has(step.id);
              const hasDetails = step.details && Object.keys(step.details).length > 0;

              return (
                <div key={step.id} className="relative">
                  {/* Timeline line */}
                  {index < trace.steps.length - 1 && (
                    <div className="absolute left-3 top-8 h-full w-0.5 bg-slate-200" />
                  )}

                  {/* Step card */}
                  <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {/* Step icon */}
                    <div className={`absolute -left-1 top-4 flex h-6 w-6 items-center justify-center rounded-full ${getStepStatusColor(step.status)} text-xs font-bold text-white shadow-sm`}>
                      {getStepStatusIcon(step.status)}
                    </div>

                    {/* Step content */}
                    <div className="ml-8">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-500">{getTypeLabel(step.type)}</span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">{step.timestamp}</span>
                            {step.duration_ms && (
                              <>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-500">{step.duration_ms}ms</span>
                              </>
                            )}
                          </div>
                          <div className="text-sm font-medium text-slate-900">{step.label}</div>
                        </div>

                        {hasDetails && (
                          <button
                            onClick={() => toggleStep(step.id)}
                            className="ml-2 rounded px-2 py-1 text-xs font-medium text-sky-600 hover:bg-sky-50"
                          >
                            {isExpanded ? "Hide" : "Details"}
                          </button>
                        )}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && hasDetails && (
                        <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                          {step.details?.endpoint && (
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-slate-500">Endpoint</div>
                              <code className="block rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                {step.details.endpoint}
                              </code>
                            </div>
                          )}
                          {step.details?.engine && (
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-slate-500">Engine</div>
                              <div className="text-xs text-slate-700">{step.details.engine}</div>
                            </div>
                          )}
                          {step.details?.query && (
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-slate-500">Query</div>
                              <div className="rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                {step.details.query}
                              </div>
                            </div>
                          )}
                          {step.details?.result && (
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-slate-500">Result</div>
                              <div className="rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                {step.details.result}
                              </div>
                            </div>
                          )}
                          {step.details?.payload && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-medium text-slate-500">Request Payload</div>
                                <button
                                  onClick={() => copyToClipboard(JSON.stringify(step.details!.payload, null, 2))}
                                  className="text-xs text-sky-600 hover:text-sky-700"
                                >
                                  Copy JSON
                                </button>
                              </div>
                              <pre className="max-h-40 overflow-auto rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                {JSON.stringify(step.details.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                          {step.details?.response && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="text-xs font-medium text-slate-500">Response</div>
                                <button
                                  onClick={() => copyToClipboard(JSON.stringify(step.details!.response, null, 2))}
                                  className="text-xs text-sky-600 hover:text-sky-700"
                                >
                                  Copy JSON
                                </button>
                              </div>
                              <pre className="max-h-40 overflow-auto rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                                {JSON.stringify(step.details.response, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
