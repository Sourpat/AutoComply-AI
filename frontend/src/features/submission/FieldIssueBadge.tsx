/**
 * FieldIssueBadge - Inline badge for field-level validation issues
 * 
 * Shows severity-colored badge next to form fields when field_issues exist.
 * Includes hover tooltip with full message and check name.
 */

import React, { useState } from 'react';

export interface FieldIssue {
  field: string;
  severity: 'critical' | 'medium' | 'low';
  check?: string;
  message: string;
}

interface FieldIssueBadgeProps {
  severity: 'critical' | 'medium' | 'low';
  message: string;
  check?: string;
  count?: number; // For multiple issues on same field
}

export function FieldIssueBadge({ severity, message, check, count }: FieldIssueBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const severityColors = {
    critical: {
      bg: 'bg-red-100',
      border: 'border-red-300',
      text: 'text-red-700',
      icon: '⚠',
      label: 'Critical',
    },
    medium: {
      bg: 'bg-amber-100',
      border: 'border-amber-300',
      text: 'text-amber-700',
      icon: '⚡',
      label: 'Medium',
    },
    low: {
      bg: 'bg-blue-100',
      border: 'border-blue-300',
      text: 'text-blue-700',
      icon: 'ℹ',
      label: 'Low',
    },
  };

  const colors = severityColors[severity];

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors.bg} ${colors.border} ${colors.text} hover:opacity-80 transition-opacity`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
      >
        <span>{colors.icon}</span>
        <span>{colors.label}</span>
        {count && count > 1 && (
          <span className={`ml-0.5 px-1 rounded-full ${colors.bg} ${colors.text} font-bold`}>
            {count}
          </span>
        )}
      </button>

      {showTooltip && (
        <div className="absolute left-0 top-full mt-1 z-50 w-64 p-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg">
          <div className="space-y-1">
            {check && (
              <div className="font-semibold text-slate-300 text-[10px] uppercase tracking-wide">
                {check}
              </div>
            )}
            <div className="text-slate-100 leading-relaxed">
              {message}
            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute -top-1 left-3 w-2 h-2 bg-slate-900 transform rotate-45" />
        </div>
      )}
    </div>
  );
}
