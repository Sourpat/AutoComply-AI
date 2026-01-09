/**
 * Timeline component for displaying audit events chronologically.
 * Step 2.0: Workflow Status Transitions + Audit Log Timeline
 */

import type { AuditEvent, AuditAction } from "../types/audit";

interface TimelineProps {
  events: AuditEvent[];
  compact?: boolean;
}

function getActionIcon(action: AuditAction): string {
  const icons: Record<AuditAction, string> = {
    SUBMITTED: "📤",
    APPROVED: "✅",
    NEEDS_REVIEW: "⚠️",
    BLOCKED: "🚫",
    REQUEST_INFO: "📝",
    NOTE_ADDED: "📋",
    ASSIGNED: "👤",
    UNASSIGNED: "👥",
  };
  return icons[action] || "•";
}

function getActionColor(action: AuditAction): string {
  const colors: Record<AuditAction, string> = {
    SUBMITTED: "bg-blue-100 text-blue-800 border-blue-200",
    APPROVED: "bg-green-100 text-green-800 border-green-200",
    NEEDS_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
    BLOCKED: "bg-red-100 text-red-800 border-red-200",
    REQUEST_INFO: "bg-purple-100 text-purple-800 border-purple-200",
    NOTE_ADDED: "bg-gray-100 text-gray-800 border-gray-200",
    ASSIGNED: "bg-indigo-100 text-indigo-800 border-indigo-200",
    UNASSIGNED: "bg-slate-100 text-slate-800 border-slate-200",
  };
  return colors[action] || "bg-gray-100 text-gray-800 border-gray-200";
}

function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    SUBMITTED: "Submitted",
    APPROVED: "Approved",
    NEEDS_REVIEW: "Needs Review",
    BLOCKED: "Blocked",
    REQUEST_INFO: "Info Requested",
    NOTE_ADDED: "Note Added",
    ASSIGNED: "Assigned",
    UNASSIGNED: "Unassigned",
  };
  return labels[action] || action;
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return timestamp;
  }
}

export function Timeline({ events, compact = false }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-sm text-zinc-500 italic py-4">
        No timeline events yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          {/* Timeline indicator */}
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm ${getActionColor(
                event.action
              )}`}
            >
              {getActionIcon(event.action)}
            </div>
            {index < events.length - 1 && (
              <div className="w-0.5 flex-1 bg-zinc-300 min-h-[24px]" />
            )}
          </div>

          {/* Event details */}
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-zinc-900">
                    {getActionLabel(event.action)}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${getActionColor(
                      event.action
                    )}`}
                  >
                    {event.actorRole}
                  </span>
                </div>
                
                <div className="text-xs text-zinc-600 mb-1">
                  by {event.actorName} • {formatTimestamp(event.createdAt)}
                </div>

                {event.message && (
                  <div className="text-sm text-zinc-700 mt-2 bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2">
                    {event.message}
                  </div>
                )}

                {!compact && event.meta && (
                  <div className="mt-2 space-y-1">
                    {event.meta.missingFields && event.meta.missingFields.length > 0 && (
                      <div className="text-xs">
                        <span className="text-zinc-500">Missing fields:</span>{" "}
                        <span className="text-zinc-700">
                          {event.meta.missingFields.join(", ")}
                        </span>
                      </div>
                    )}
                    {event.meta.firedRuleIds && event.meta.firedRuleIds.length > 0 && (
                      <div className="text-xs">
                        <span className="text-zinc-500">Rules:</span>{" "}
                        <span className="font-mono text-zinc-700">
                          {event.meta.firedRuleIds.slice(0, 3).join(", ")}
                          {event.meta.firedRuleIds.length > 3 && ` +${event.meta.firedRuleIds.length - 3} more`}
                        </span>
                      </div>
                    )}
                    {event.meta.evidenceDocIds && event.meta.evidenceDocIds.length > 0 && (
                      <div className="text-xs">
                        <span className="text-zinc-500">Evidence:</span>{" "}
                        <span className="text-zinc-700">
                          {event.meta.evidenceDocIds.length} documents
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
