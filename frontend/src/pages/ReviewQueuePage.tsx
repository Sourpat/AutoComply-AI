// frontend/src/pages/ReviewQueuePage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getWorkQueue, updateSubmission, type WorkQueueSubmission } from "../api/consoleClient";
import { PageHeader } from "../components/common/PageHeader";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorState } from "../components/common/ErrorState";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { AgentActionPanel } from "../components/agentic/AgentActionPanel";
import { AgentEventTimeline } from "../components/agentic/AgentEventTimeline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { cn } from "../lib/utils";
import { formatTimestamp } from "../lib/formatters";
import { getStatusLabel, getStatusTone } from "../lib/formatters";
import { API_BASE } from "../lib/api";

export function ReviewQueuePage() {
  type AgenticCaseSummary = {
    caseId: string;
    title: string;
    summary?: string | null;
    status: string;
    updatedAt: string;
  };

  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('admin_unlocked') === 'true');
  const [items, setItems] = useState<WorkQueueSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{ open: boolean; submission: WorkQueueSubmission | null }>({ 
    open: false, 
    submission: null 
  });
  const [isSaving, setIsSaving] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "in_review">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [agenticCases, setAgenticCases] = useState<AgenticCaseSummary[]>([]);
  const [agenticLoading, setAgenticLoading] = useState(true);
  const [agenticError, setAgenticError] = useState<string | null>(null);
  const [selectedAgenticCaseId, setSelectedAgenticCaseId] = useState<string | null>(null);

  // Fetch work queue items
  async function fetchItems() {
    setLoading(true);
    setError(null);
    try {
      const response = await getWorkQueue(undefined, "submitted,in_review", 100);
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review queue");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgenticCases() {
    setAgenticLoading(true);
    setAgenticError(null);
    try {
      const response = await fetch(`${API_BASE}/api/agentic/cases`);
      if (!response.ok) {
        throw new Error(`Failed to load agentic cases (${response.status})`);
      }
      const data = (await response.json()) as AgenticCaseSummary[];
      setAgenticCases(data);
      if (!selectedAgenticCaseId && data.length > 0) {
        setSelectedAgenticCaseId(data[0].caseId);
      }
    } catch (err) {
      setAgenticError(err instanceof Error ? err.message : "Failed to load agentic cases");
    } finally {
      setAgenticLoading(false);
    }
  }

  async function seedDemoCases() {
    try {
      const response = await fetch(`${API_BASE}/api/agentic/demo/seed`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Failed to seed demo cases (${response.status})`);
      }
      toast.success("Demo cases created");
      await fetchAgenticCases();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to seed demo cases");
    }
  }

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    fetchAgenticCases();
  }, []);

  // Admin state sync
  useEffect(() => {
    const checkAdmin = () => {
      setIsAdmin(localStorage.getItem('admin_unlocked') === 'true');
    };
    
    window.addEventListener('storage', checkAdmin);
    const interval = setInterval(checkAdmin, 1000);
    
    return () => {
      window.removeEventListener('storage', checkAdmin);
      clearInterval(interval);
    };
  }, []);

  // Reviewer action handlers
  async function handleStartReview(submissionId: string) {
    setActionInProgress(submissionId);
    try {
      await updateSubmission(submissionId, { status: 'in_review', reviewed_by: 'admin' });
      toast.success("Review started successfully");
      await fetchItems();
    } catch (err) {
      console.error('Failed to start review:', err);
      setError('Failed to start review');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleApprove(submissionId: string) {
    setActionInProgress(submissionId);
    try {
      await updateSubmission(submissionId, { status: 'approved', reviewed_by: 'admin' });
      toast.success("Submission approved");
      await fetchItems();
    } catch (err) {
      console.error('Failed to approve:', err);
      setError('Failed to approve submission');
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleReject(submissionId: string) {
    setActionInProgress(submissionId);
    try {
      await updateSubmission(submissionId, { status: 'rejected', reviewed_by: 'admin' });
      toast.success("Submission rejected");
      await fetchItems();
    } catch (err) {
      console.error('Failed to reject:', err);
      setError('Failed to reject submission');
    } finally {
      setActionInProgress(null);
    }
  }

  function handleOpenNotes(submission: WorkQueueSubmission) {
    setNotesModal({ open: true, submission });
    setNotesDraft(submission.reviewer_notes ?? "");
  }

  async function handleSaveNotes() {
    if (!notesModal.submission) return;
    
    setIsSaving(true);
    try {
      const notes = notesDraft;
      await updateSubmission(notesModal.submission.submission_id, { 
        reviewer_notes: notes,
        reviewed_by: 'admin'
      });
      setNotesModal({ open: false, submission: null });
      toast.success("Notes saved successfully");
      await fetchItems();
    } catch (err) {
      console.error('Failed to save notes:', err);
      setError('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  }

  const filteredItems = useMemo(() => {
    const statusFiltered = statusFilter === "all"
      ? items
      : items.filter((item) => item.status === statusFilter);

    if (!searchQuery.trim()) return statusFiltered;

    const query = searchQuery.toLowerCase();
    return statusFiltered.filter((item) =>
      [item.title, item.subtitle, item.submission_id, item.trace_id]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [items, statusFilter, searchQuery]);

  const statusVariant = (status: string) => {
    const tone = getStatusTone(status);
    return tone === "neutral" ? "secondary" : tone;
  };

  const agenticStatusVariant = (status: string) => {
    if (status === "approved") return "success";
    if (status === "blocked") return "destructive";
    if (status === "needs_input") return "warning";
    if (status === "queued_review") return "warning";
    if (status === "evaluating") return "info";
    return "secondary";
  };

  // If not admin, show access denied
  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Review Queue"
          subtitle="Admin access is required to review and approve submissions."
        />
        <Card>
          <CardContent className="py-10">
            <ErrorState
              title="Admin mode required"
              description="Enable admin mode to access the review queue and manage submissions."
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/console">← Back to Console</Link>
              </Button>
              <Button asChild>
                <a href="/console?admin=true">Enable Admin Mode</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Queue"
        subtitle="Review and approve CSF submissions requiring manual verification."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="warning">Admin Mode</Badge>
            <Button onClick={fetchItems} variant="secondary" disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Agentic Review Queue</h2>
              <p className="text-sm text-muted-foreground">
                Deterministic agent plans with action and event timeline.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={seedDemoCases}>
              Create demo cases
            </Button>
          </div>

          {agenticError && (
            <ErrorState
              title="Unable to load agentic cases"
              description={agenticError}
              onRetry={fetchAgenticCases}
            />
          )}

          {agenticLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : agenticCases.length === 0 ? (
            <EmptyState
              title="No agentic cases yet"
              description="Create demo cases to preview the agentic workflow loop."
              actionLabel="Create demo cases"
              onAction={seedDemoCases}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[280px,1fr]">
              <div className="space-y-2">
                {agenticCases.map((agenticCase) => (
                  <button
                    key={agenticCase.caseId}
                    onClick={() => setSelectedAgenticCaseId(agenticCase.caseId)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition",
                      selectedAgenticCaseId === agenticCase.caseId
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/70 bg-background hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {agenticCase.title}
                      </span>
                      <Badge variant={agenticStatusVariant(agenticCase.status)}>
                        {agenticCase.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {agenticCase.summary || "No summary"}
                    </p>
                  </button>
                ))}
              </div>

              {selectedAgenticCaseId && (
                <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                  <AgentActionPanel caseId={selectedAgenticCaseId} />
                  <AgentEventTimeline caseId={selectedAgenticCaseId} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | "submitted" | "in_review")}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="submitted">Submitted</TabsTrigger>
                <TabsTrigger value="in_review">In review</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search submissions..."
                className="sm:w-72"
              />
            </div>
          </div>

          {error && (
            <ErrorState
              title="Unable to load review queue"
              description={error}
              onRetry={fetchItems}
            />
          )}

          {loading && items.length === 0 ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="No submissions match your filters"
              description="Try adjusting the status tabs or search query to find submissions awaiting review."
              actionLabel="Refresh queue"
              onAction={fetchItems}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/70">
              <table className="table-premium">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Trace</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isWorking = actionInProgress === item.submission_id;

                    return (
                      <tr key={item.submission_id}>
                        <td>
                          <Badge variant="outline">{item.csf_type.toUpperCase()}</Badge>
                        </td>
                        <td>
                          <div className="text-sm font-medium text-foreground">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.subtitle}</div>
                        </td>
                        <td>
                          <Badge variant={statusVariant(item.status)}>
                            {getStatusLabel(item.status)}
                          </Badge>
                        </td>
                        <td className="text-muted-foreground">
                          {formatTimestamp(item.created_at)}
                        </td>
                        <td>
                          {item.trace_id ? (
                            <Link
                              to={`/console?trace=${item.trace_id}`}
                              className="text-sm font-medium text-primary hover:text-primary/80"
                            >
                              Open trace →
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" disabled={isWorking}>
                                {isWorking ? "Working..." : "Actions"}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {item.status === "submitted" && (
                                <DropdownMenuItem
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    handleStartReview(item.submission_id);
                                  }}
                                  disabled={isWorking}
                                >
                                  Start review
                                </DropdownMenuItem>
                              )}
                              {item.status === "in_review" && (
                                <>
                                  <DropdownMenuItem
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      handleApprove(item.submission_id);
                                    }}
                                    disabled={isWorking}
                                  >
                                    Approve submission
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      handleReject(item.submission_id);
                                    }}
                                    disabled={isWorking}
                                  >
                                    Reject submission
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={(event) => {
                                  event.preventDefault();
                                  handleOpenNotes(item);
                                }}
                              >
                                Reviewer notes
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredItems.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Showing {filteredItems.length} submission{filteredItems.length !== 1 ? "s" : ""}.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={notesModal.open}
        onOpenChange={(open) => {
          if (!open) {
            setNotesModal({ open: false, submission: null });
            setNotesDraft("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reviewer Notes</DialogTitle>
            <DialogDescription>
              {notesModal.submission?.title ?? "Add context for this submission."}
            </DialogDescription>
          </DialogHeader>

          {notesModal.submission?.reviewer_notes && (
            <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Current notes</p>
              <p className="mt-2 text-sm text-foreground">
                {notesModal.submission.reviewer_notes}
              </p>
            </div>
          )}

          <textarea
            className={cn(
              "min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
            rows={6}
            placeholder="Enter reviewer notes here..."
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
          />

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNotesModal({ open: false, submission: null })}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveNotes} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
