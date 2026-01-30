/**
 * CaseWorkspace - Enterprise case review workspace
 * 
 * 2-column layout:
 * - Left (30-35%): WorkQueueListPanel
 * - Right (65-70%): CaseDetailsPanel
 * 
 * Step 2.4: Case Details Workspace
 */

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { viewStore } from "../lib/viewStore";
import type { QueueView, SortField, SortDirection } from "../types/views";
import type { WorkQueueItem as DemoWorkQueueItem } from "../types/workQueue";
import { WorkQueueListPanel } from "../features/cases/WorkQueueListPanel";
import { CaseDetailsPanel } from "../features/cases/CaseDetailsPanel";
import { useRole } from "../context/RoleContext";
import { getCurrentDemoUser } from "../demo/users";
import { isOverdue } from "../workflow/sla";
import { useWorkQueue } from "../workflow/useWorkflowStore";
import { PageHeader } from "../components/common/PageHeader";
import { ErrorState } from "../components/common/ErrorState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { AgentActionPanel } from "../components/agentic/AgentActionPanel";

export const CaseWorkspace: React.FC = () => {
  const { role } = useRole();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [queueFilter, setQueueFilter] = useState<"all" | "mine" | "unassigned" | "overdue">(
    (searchParams.get('filter') as "all" | "mine" | "unassigned" | "overdue") || "all"
  );
  const [sortField, setSortField] = useState<SortField>((searchParams.get('sort') as SortField) || 'overdue');
  const [sortDirection, setSortDirection] = useState<SortDirection>((searchParams.get('dir') as SortDirection) || 'desc');
  const [savedViews, setSavedViews] = useState<QueueView[]>([]);
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [showManageViewsModal, setShowManageViewsModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [setNewViewAsDefault, setSetNewViewAsDefault] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(500);

  const currentUser = getCurrentDemoUser(role);
  const selectedCaseId = searchParams.get('caseId');
  
  // Load work queue from API instead of demo store
  const { items: workQueueItems, isLoading: isLoadingQueue, error: queueError, reload: reloadQueue } = useWorkQueue(true);

  // Load saved views on mount
  useEffect(() => {
    setSavedViews(viewStore.listViews());
  }, []);

  // URL synchronization - update URL when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (sortField !== 'overdue') params.set('sort', sortField);
    if (sortDirection !== 'desc') params.set('dir', sortDirection);
    if (queueFilter !== 'all') params.set('filter', queueFilter);
    if (selectedCaseId) params.set('caseId', selectedCaseId);
    
    setSearchParams(params, { replace: true });
  }, [searchQuery, sortField, sortDirection, queueFilter, selectedCaseId, setSearchParams]);

  // Filter, search, and sort work queue items
  const filteredAndSortedItems = useMemo(() => {
    let items = workQueueItems || [];
    
    // Apply queue filter
    if (queueFilter === "mine" && currentUser) {
      items = items.filter((i) => i.assignedTo?.id === currentUser.id);
    } else if (queueFilter === "unassigned") {
      items = items.filter((i) => !i.assignedTo);
    } else if (queueFilter === "overdue") {
      items = items.filter((i) => isOverdue(i.dueAt));
    }
    
    // Apply search query
    if (searchQuery.trim()) {
      const tokens = searchQuery.toLowerCase().trim().split(/\s+/);
      items = items.filter((item) => {
        const searchableText = [
          item.id,
          item.title,
          item.subtitle,
          item.reason,
          item.status,
          item.priority,
          item.assignedTo?.name || '',
          item.submissionId || '',
        ].join(' ').toLowerCase();
        
        return tokens.every((token) => searchableText.includes(token));
      });
    }
    
    // Apply sorting
    items.sort((a, b) => {
      let compareResult = 0;
      
      switch (sortField) {
        case 'overdue':
          const aOverdue = isOverdue(a.dueAt);
          const bOverdue = isOverdue(b.dueAt);
          if (aOverdue && !bOverdue) compareResult = -1;
          else if (!aOverdue && bOverdue) compareResult = 1;
          else {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const aPri = priorityOrder[a.priority];
            const bPri = priorityOrder[b.priority];
            if (aPri !== bPri) compareResult = aPri - bPri;
            else {
              compareResult = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }
          }
          break;
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          compareResult = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'age':
          compareResult = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'status':
          compareResult = a.status.localeCompare(b.status);
          break;
        case 'assignee':
          const aAssignee = a.assignedTo?.name || '';
          const bAssignee = b.assignedTo?.name || '';
          compareResult = aAssignee.localeCompare(bAssignee);
          break;
      }
      
      return sortDirection === 'asc' ? compareResult : -compareResult;
    });

    return items;
  }, [queueFilter, searchQuery, sortField, sortDirection, currentUser, workQueueItems]);

  // Paginated items for display
  const displayedItems = filteredAndSortedItems.slice(0, displayLimit);
  const hasMoreItems = filteredAndSortedItems.length > displayLimit;

  // Auto-select first item if none selected
  useEffect(() => {
    if (!selectedCaseId && displayedItems.length > 0) {
      handleSelectCase(displayedItems[0].id);
    }
  }, [displayedItems, selectedCaseId]);

  const handleSelectCase = (caseId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('caseId', caseId);
    setSearchParams(params);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;

    const newView = viewStore.saveView({
      name: newViewName,
      query: searchQuery,
      filters: {
        status: queueFilter === 'all' ? undefined : [queueFilter],
      },
      sort: { field: sortField, direction: sortDirection },
      isDefault: setNewViewAsDefault,
    });

    setSavedViews(viewStore.listViews());
    setShowSaveViewModal(false);
    setNewViewName('');
    setSetNewViewAsDefault(false);
  };

  const handleLoadView = (view: QueueView) => {
    setSearchQuery(view.query);
    setSortField(view.sort.field);
    setSortDirection(view.sort.direction);
    if (view.filters.status && view.filters.status.length > 0) {
      setQueueFilter(view.filters.status[0] as "all" | "mine" | "unassigned" | "overdue");
    }
  };

  const handleDeleteView = (viewId: string) => {
    viewStore.deleteView(viewId);
    setSavedViews(viewStore.listViews());
  };

  const handleCaseUpdate = () => {
    // Force re-render of list by updating state
    setSearchQuery(searchQuery + " "); // Trigger re-render
    setSearchQuery(searchQuery.trim());
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {queueError && (
        <ErrorState
          title="Backend Not Reachable"
          description="Cannot load cases from http://127.0.0.1:8001"
          onRetry={reloadQueue}
        />
      )}

      <PageHeader
        title="Case Workspace"
        subtitle="Review and manage verification cases"
        actions={
          <Button variant="secondary" onClick={reloadQueue} disabled={isLoadingQueue}>
            {isLoadingQueue ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      <div className="flex-1 flex overflow-hidden rounded-xl border border-border/70 bg-background">
        {/* Left Panel: Queue List (30-35%) */}
        <div className="w-[35%] bg-card border-r border-border/70 flex flex-col">
          {/* Search, Sort, Views */}
          <div className="border-b border-border/70 p-4 space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search cases..."
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort & Views */}
            <div className="flex gap-2">
              <select
                value={`${sortField}-${sortDirection}`}
                onChange={(e) => {
                  const [field, dir] = e.target.value.split('-') as [SortField, SortDirection];
                  setSortField(field);
                  setSortDirection(dir);
                }}
                className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="overdue-desc">⚠️ Overdue First</option>
                <option value="priority-desc">🔴 Priority (High→Low)</option>
                <option value="priority-asc">🔵 Priority (Low→High)</option>
                <option value="age-desc">⏰ Newest First</option>
                <option value="age-asc">⏰ Oldest First</option>
                <option value="status-asc">📊 Status (A→Z)</option>
                <option value="status-desc">📊 Status (Z→A)</option>
                <option value="assignee-asc">👤 Assignee (A→Z)</option>
                <option value="assignee-desc">👤 Assignee (Z→A)</option>
              </select>

              <div className="relative">
                <button
                  onClick={() => setShowManageViewsModal(!showManageViewsModal)}
                  className="px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white hover:bg-slate-50 font-medium"
                >
                  📁
                </button>
                {showManageViewsModal && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowManageViewsModal(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg border border-slate-200 bg-white shadow-lg py-1">
                      {savedViews.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500 italic">No saved views</div>
                      ) : (
                        savedViews.map((view) => (
                          <div key={view.id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-50">
                            <button
                              onClick={() => {
                                handleLoadView(view);
                                setShowManageViewsModal(false);
                              }}
                              className="flex-1 text-left text-xs font-medium text-slate-700"
                            >
                              {view.isDefault && "⭐ "}
                              {view.name}
                            </button>
                            <button
                              onClick={() => handleDeleteView(view.id)}
                              className="ml-2 text-xs text-red-600 hover:text-red-800"
                            >
                              🗑️
                            </button>
                          </div>
                        ))
                      )}
                      <div className="border-t border-slate-200 mt-1 pt-1">
                        <button
                          onClick={() => {
                            setShowManageViewsModal(false);
                            setShowSaveViewModal(true);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-sky-600 hover:bg-sky-50"
                        >
                          + Save View
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Queue Filters */}
            <div className="flex gap-2">
              <button
                onClick={() => setQueueFilter("all")}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  queueFilter === "all" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                All
              </button>
              {currentUser && (
                <button
                  onClick={() => setQueueFilter("mine")}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    queueFilter === "mine" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  My Cases
                </button>
              )}
              <button
                onClick={() => setQueueFilter("unassigned")}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  queueFilter === "unassigned" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Unassigned
              </button>
              <button
                onClick={() => setQueueFilter("overdue")}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  queueFilter === "overdue" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Overdue
              </button>
            </div>

            {/* Item Count */}
            <div className="text-xs text-slate-500">
              Showing {displayedItems.length} of {filteredAndSortedItems.length} {filteredAndSortedItems.length === 1 ? 'case' : 'cases'}
            </div>
          </div>

          {/* Queue List */}
          <div className="flex-1 overflow-y-auto">
            <WorkQueueListPanel
              items={displayedItems}
              selectedCaseId={selectedCaseId}
              onSelectCase={handleSelectCase}
            />
            
            {/* Load More Button */}
            {hasMoreItems && (
              <div className="p-4 border-t border-slate-200">
                <button
                  onClick={() => setDisplayLimit(prev => prev + 50)}
                  className="w-full px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  📄 Load more ({filteredAndSortedItems.length - displayLimit} remaining)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Case Details (65-70%) */}
        <div className="flex-1 overflow-hidden">
          {selectedCaseId ? (
            <div className="flex h-full flex-col gap-4 overflow-hidden">
              <AgentActionPanel caseId="demo-1" />
              <div className="flex-1 overflow-hidden">
                <CaseDetailsPanel
                  key={selectedCaseId}
                  caseId={selectedCaseId}
                  onCaseUpdate={handleCaseUpdate}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500">Select a case to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Save View Modal */}
      {showSaveViewModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowSaveViewModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Save Current View</h3>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">View Name</label>
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="e.g., My High Priority Cases"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={setNewViewAsDefault}
                    onChange={(e) => setSetNewViewAsDefault(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Set as default view
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveView}
                  disabled={!newViewName.trim()}
                  className="flex-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save View
                </button>
                <button
                  onClick={() => {
                    setShowSaveViewModal(false);
                    setNewViewName('');
                    setSetNewViewAsDefault(false);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CaseWorkspace;
