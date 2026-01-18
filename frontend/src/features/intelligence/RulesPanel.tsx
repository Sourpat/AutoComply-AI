import React, { useState } from "react";
import type { FailedRule } from "../../api/intelligenceApi";

interface RulesPanelProps {
  rulesTotal: number;
  rulesPassed: number;
  failedRules: FailedRule[];
}

/**
 * RulesPanel Component
 * 
 * Displays validation rule results with:
 * - Overall pass/fail count
 * - Collapsible failed rules grouped by severity
 * - Detailed information per failed rule
 */
export const RulesPanel: React.FC<RulesPanelProps> = ({
  rulesTotal,
  rulesPassed,
  failedRules,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // If no failed rules, show success state
  if (failedRules.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-900/50 border border-emerald-700">
            <span className="text-emerald-300 text-sm">✓</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-emerald-300">All Rules Passed</h3>
            <p className="text-xs text-emerald-400/80">
              {rulesTotal} validation rules passed successfully
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Group failed rules by severity
  const criticalRules = failedRules.filter(r => r.severity === 'critical');
  const mediumRules = failedRules.filter(r => r.severity === 'medium');
  const lowRules = failedRules.filter(r => r.severity === 'low');

  const getSeverityIcon = (severity: 'critical' | 'medium' | 'low') => {
    switch (severity) {
      case 'critical':
        return '⛔';
      case 'medium':
        return '⚠';
      case 'low':
        return 'ℹ';
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left"
        >
          <span
            className="text-zinc-400 transition-transform duration-200"
            style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
          <div>
            <h3 className="text-sm font-semibold text-zinc-50">Validation Rules</h3>
            <p className="text-xs text-zinc-400">
              Passed {rulesPassed}/{rulesTotal} rules · {failedRules.length} failed
            </p>
          </div>
        </button>

        {/* Summary badges */}
        <div className="flex items-center gap-2">
          {criticalRules.length > 0 && (
            <span className="rounded-full bg-red-950/50 border border-red-800/50 px-2 py-0.5 text-xs font-medium text-red-300">
              {criticalRules.length} Critical
            </span>
          )}
          {mediumRules.length > 0 && (
            <span className="rounded-full bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 text-xs font-medium text-amber-300">
              {mediumRules.length} Medium
            </span>
          )}
          {lowRules.length > 0 && (
            <span className="rounded-full bg-yellow-950/50 border border-yellow-800/50 px-2 py-0.5 text-xs font-medium text-yellow-300">
              {lowRules.length} Low
            </span>
          )}
        </div>
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="space-y-3">
          {/* Critical rules */}
          {criticalRules.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-red-400">
                <span>{getSeverityIcon('critical')}</span>
                Critical Failures ({criticalRules.length})
              </h4>
              <div className="space-y-2">
                {criticalRules.map((rule, idx) => (
                  <RuleCard key={idx} rule={rule} />
                ))}
              </div>
            </div>
          )}

          {/* Medium rules */}
          {mediumRules.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-400">
                <span>{getSeverityIcon('medium')}</span>
                Medium Failures ({mediumRules.length})
              </h4>
              <div className="space-y-2">
                {mediumRules.map((rule, idx) => (
                  <RuleCard key={idx} rule={rule} />
                ))}
              </div>
            </div>
          )}

          {/* Low rules */}
          {lowRules.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-yellow-400">
                <span>{getSeverityIcon('low')}</span>
                Low Severity Failures ({lowRules.length})
              </h4>
              <div className="space-y-2">
                {lowRules.map((rule, idx) => (
                  <RuleCard key={idx} rule={rule} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * RuleCard Component
 * 
 * Individual failed rule card with details
 */
const RuleCard: React.FC<{ rule: FailedRule }> = ({ rule }) => {
  const getSeverityClass = (severity: 'critical' | 'medium' | 'low') => {
    switch (severity) {
      case 'critical':
        return 'border-red-800/50 bg-red-950/20';
      case 'medium':
        return 'border-amber-800/50 bg-amber-950/20';
      case 'low':
        return 'border-yellow-800/50 bg-yellow-950/20';
    }
  };

  const getSeverityTextClass = (severity: 'critical' | 'medium' | 'low') => {
    switch (severity) {
      case 'critical':
        return 'text-red-300';
      case 'medium':
        return 'text-amber-300';
      case 'low':
        return 'text-yellow-300';
    }
  };

  return (
    <div className={`rounded border ${getSeverityClass(rule.severity)} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {/* Rule title or ID */}
          <h5 className={`text-xs font-semibold ${getSeverityTextClass(rule.severity)}`}>
            {rule.title || rule.rule_id}
          </h5>

          {/* Message */}
          <p className="mt-1 text-xs text-zinc-300">
            {rule.message}
          </p>

          {/* Field path */}
          {rule.field_path && (
            <p className="mt-1.5 text-[10px] text-zinc-500">
              Field: <code className="rounded bg-zinc-900/50 px-1 py-0.5">{rule.field_path}</code>
            </p>
          )}

          {/* Expected/Actual values (if provided) */}
          {(rule.expected !== undefined || rule.actual !== undefined) && (
            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-zinc-500">
              {rule.expected !== undefined && (
                <span>
                  Expected: <code className="rounded bg-zinc-900/50 px-1 py-0.5">{String(rule.expected)}</code>
                </span>
              )}
              {rule.actual !== undefined && (
                <span>
                  Actual: <code className="rounded bg-zinc-900/50 px-1 py-0.5">{String(rule.actual)}</code>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Severity badge */}
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${getSeverityTextClass(rule.severity)}`}>
          {rule.severity}
        </span>
      </div>
    </div>
  );
};
