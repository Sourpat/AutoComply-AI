/**
 * WorkQueueListPanel - Left pane showing list of verification cases
 * 
 * Reusable queue list component with search/filter/sort.
 * Step 2.4: Case Details Workspace
 */

import React from "react";
import { demoStore } from "../../lib/demoStore";
import type { WorkQueueItem as DemoWorkQueueItem } from "../../types/workQueue";
import { isOverdue, formatAgeShort, formatDue, getSlaStatusColor } from "../../workflow/sla";

interface WorkQueueListPanelProps {
  items: DemoWorkQueueItem[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
  showActions?: boolean;
}

export const WorkQueueListPanel: React.FC<WorkQueueListPanelProps> = ({
  items,
  selectedCaseId,
  onSelectCase,
  showActions = false,
}) => {
  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="text-sm">No cases match your filters</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200">
      {items.map((item) => {
        const isSelected = item.id === selectedCaseId;
        const overdueStatus = isOverdue(item.dueAt);
        const slaColor = getSlaStatusColor(item.dueAt);
        const age = formatAgeShort(new Date(item.createdAt).getTime());

        return (
          <div
            key={item.id}
            onClick={() => onSelectCase(item.id)}
            className={`p-4 cursor-pointer transition-colors hover:bg-sky-50 ${
              isSelected ? "bg-sky-100 border-l-4 border-sky-600" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Title */}
                <h3 className="text-sm font-semibold text-slate-900 truncate">
                  {item.title}
                </h3>
                
                {/* Subtitle/Reason */}
                {item.subtitle && (
                  <p className="text-xs text-slate-600 mt-0.5 truncate">
                    {item.subtitle}
                  </p>
                )}

                {/* Metadata row */}
                <div className="flex items-center gap-3 mt-2 text-xs">
                  {/* Status */}
                  <span
                    className={`px-2 py-0.5 rounded-full font-medium ${
                      item.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : item.status === "blocked"
                        ? "bg-red-100 text-red-800"
                        : item.status === "needs_review"
                        ? "bg-amber-100 text-amber-800"
                        : item.status === "request_info"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {item.status.replace("_", " ")}
                  </span>

                  {/* Priority */}
                  <span
                    className={`font-medium ${
                      item.priority === "high"
                        ? "text-red-700"
                        : item.priority === "medium"
                        ? "text-amber-700"
                        : "text-slate-600"
                    }`}
                  >
                    {item.priority === "high" ? "🔴" : item.priority === "medium" ? "🟡" : "🟢"}{" "}
                    {item.priority}
                  </span>

                  {/* Age */}
                  <span className="text-slate-500">{age}</span>
                </div>

                {/* Assignee + SLA row */}
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  {/* Assignee */}
                  {item.assignedTo ? (
                    <span className="text-slate-600">
                      👤 {item.assignedTo.name}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Unassigned</span>
                  )}

                  {/* SLA */}
                  {item.dueAt && (
                    <span className={`font-medium ${slaColor}`}>
                      {overdueStatus && "⚠️ "}
                      Due: {formatDue(item.dueAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
