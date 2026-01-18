import React, { useState } from "react";

interface FieldIssue {
  field: string;
  severity: 'critical' | 'medium' | 'low';
  check?: string;
  message: string;
}

interface FieldIssuesPanelProps {
  fieldIssues: FieldIssue[];
  fieldChecksTotal?: number;
  fieldChecksPassed?: number;
}

/**
 * FieldIssuesPanel Component
 * 
 * Displays field-level validation issues grouped by severity.
 * Shows critical, medium, and low priority issues with collapsible sections.
 */
export const FieldIssuesPanel: React.FC<FieldIssuesPanelProps> = ({
  fieldIssues,
  fieldChecksTotal = 0,
  fieldChecksPassed = 0,
}) => {
  const [showAllCritical, setShowAllCritical] = useState(false);
  const [showAllMedium, setShowAllMedium] = useState(false);
  const [showAllLow, setShowAllLow] = useState(false);

  // Group issues by severity
  const criticalIssues = fieldIssues.filter(i => i.severity === 'critical');
  const mediumIssues = fieldIssues.filter(i => i.severity === 'medium');
  const lowIssues = fieldIssues.filter(i => i.severity === 'low');

  const hasCritical = criticalIssues.length > 0;
  const hasMedium = mediumIssues.length > 0;
  const hasLow = lowIssues.length > 0;

  // Show max 3 by default, expand to show all
  const displayedCritical = showAllCritical ? criticalIssues : criticalIssues.slice(0, 3);
  const displayedMedium = showAllMedium ? mediumIssues : mediumIssues.slice(0, 3);
  const displayedLow = showAllLow ? lowIssues : lowIssues.slice(0, 3);

  const hasMoreCritical = criticalIssues.length > 3;
  const hasMoreMedium = mediumIssues.length > 3;
  const hasMoreLow = lowIssues.length > 3;

  // If no issues, show success state
  if (fieldIssues.length === 0 && fieldChecksTotal > 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h3 className="text-sm font-semibold text-zinc-50">Field Validation</h3>
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-950/50 px-2.5 py-1">
            <span className="text-xs font-medium text-emerald-300">
              {fieldChecksPassed}/{fieldChecksTotal} Passed
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded border border-emerald-800/30 bg-emerald-950/20 p-3">
          <span className="text-emerald-400">✓</span>
          <span className="text-xs text-zinc-300">All field validations passed</span>
        </div>
      </div>
    );
  }

  // If no field checks data available, don't render
  if (fieldChecksTotal === 0 && fieldIssues.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <h3 className="text-sm font-semibold text-zinc-50">Field Validation</h3>
        <div className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
          hasCritical 
            ? 'bg-red-950/50 border-red-800/50' 
            : hasMedium 
            ? 'bg-amber-950/50 border-amber-800/50'
            : 'bg-zinc-800/50 border-zinc-700/50'
        }">
          {hasCritical && <span className="text-red-400 text-xs">⚠</span>}
          <span className={`text-xs font-medium ${
            hasCritical 
              ? 'text-red-300' 
              : hasMedium 
              ? 'text-amber-300'
              : 'text-zinc-400'
          }`}>
            {fieldChecksPassed}/{fieldChecksTotal} Passed
          </span>
        </div>
      </div>

      {/* Critical Issues */}
      {hasCritical && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            <h4 className="text-xs font-semibold text-red-400">
              Critical Issues ({criticalIssues.length})
            </h4>
          </div>
          <div className="space-y-2">
            {displayedCritical.map((issue, idx) => (
              <div
                key={idx}
                className="rounded border border-red-800/30 bg-red-950/20 p-2.5"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-red-400">⚠</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-zinc-200">{issue.field}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">{issue.message}</div>
                    {issue.check && (
                      <div className="mt-1 text-xs text-zinc-500">Check: {issue.check}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {hasMoreCritical && (
              <button
                onClick={() => setShowAllCritical(!showAllCritical)}
                className="text-xs text-red-400 hover:text-red-300"
              >
                {showAllCritical 
                  ? 'Show less' 
                  : `Show ${criticalIssues.length - 3} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Medium Issues */}
      {hasMedium && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <h4 className="text-xs font-semibold text-amber-400">
              Medium Priority ({mediumIssues.length})
            </h4>
          </div>
          <div className="space-y-2">
            {displayedMedium.map((issue, idx) => (
              <div
                key={idx}
                className="rounded border border-amber-800/30 bg-amber-950/20 p-2.5"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-amber-400">⚠</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-zinc-200">{issue.field}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">{issue.message}</div>
                    {issue.check && (
                      <div className="mt-1 text-xs text-zinc-500">Check: {issue.check}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {hasMoreMedium && (
              <button
                onClick={() => setShowAllMedium(!showAllMedium)}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                {showAllMedium 
                  ? 'Show less' 
                  : `Show ${mediumIssues.length - 3} more`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Low Priority Issues */}
      {hasLow && (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            <h4 className="text-xs font-semibold text-zinc-400">
              Low Priority ({lowIssues.length})
            </h4>
          </div>
          <div className="space-y-2">
            {displayedLow.map((issue, idx) => (
              <div
                key={idx}
                className="rounded border border-zinc-700/30 bg-zinc-900/20 p-2.5"
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-zinc-500">•</span>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-zinc-200">{issue.field}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">{issue.message}</div>
                    {issue.check && (
                      <div className="mt-1 text-xs text-zinc-500">Check: {issue.check}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {hasMoreLow && (
              <button
                onClick={() => setShowAllLow(!showAllLow)}
                className="text-xs text-zinc-400 hover:text-zinc-300"
              >
                {showAllLow 
                  ? 'Show less' 
                  : `Show ${lowIssues.length - 3} more`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
