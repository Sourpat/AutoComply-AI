import React from "react";

interface FreshnessIndicatorProps {
  computedAt: string; // ISO 8601 timestamp
  isStale: boolean;
  staleAfterMinutes?: number;
}

/**
 * FreshnessIndicator Component
 * 
 * Displays "Last updated X min ago" and optional stale warning.
 * Phase 7.4: Intelligence Lifecycle freshness tracking.
 */
export const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({
  computedAt,
  isStale,
  staleAfterMinutes = 30,
}) => {
  // Calculate age in minutes
  const getAgeInMinutes = (): number => {
    const now = new Date();
    const computed = new Date(computedAt);
    const diffMs = now.getTime() - computed.getTime();
    return Math.floor(diffMs / (1000 * 60));
  };

  const ageMinutes = getAgeInMinutes();

  // Format age string
  const formatAge = (minutes: number): string => {
    if (minutes < 1) return "Just now";
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      {/* Age indicator */}
      <span className="text-zinc-500">
        Computed <span className="font-medium text-zinc-300">{formatAge(ageMinutes)}</span>
      </span>

      {/* Stale warning */}
      {isStale && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/50 text-amber-300 border border-amber-800/50">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-xs font-medium">Stale</span>
        </span>
      )}
    </div>
  );
};
