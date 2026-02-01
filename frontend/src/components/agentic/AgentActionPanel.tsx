import React, { useMemo, useState } from "react";
import { toast } from "sonner";

import type { AgentAction, AgentPlan, JSONSchema } from "../../contracts/agentic";
import { useAgentPlan } from "../../hooks/useAgentPlan";
import { ConfidenceHelp } from "../common/ConfidenceHelp";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";

const statusTone: Record<string, "success" | "warning" | "destructive" | "info" | "secondary"> = {
  draft: "secondary",
  evaluating: "info",
  needs_input: "warning",
  queued_review: "warning",
  approved: "success",
  blocked: "destructive",
  completed: "secondary",
};

function renderSchemaFields(
  schema: JSONSchema,
  values: Record<string, unknown>,
  onChange: (key: string, value: unknown) => void
) {
  if (schema.type !== "object" || !schema.properties) return null;

  return Object.entries(schema.properties).map(([key, field]) => {
    const fieldType = field.type;
    const value = values[key];

    if (fieldType === "boolean") {
      return (
        <label key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(key, event.target.checked)}
            className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          {field.title ?? key}
        </label>
      );
    }

    return (
      <div key={key} className="space-y-1">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {field.title ?? key}
        </label>
        <Input
          type={fieldType === "number" ? "number" : "text"}
          value={value as string | number | undefined}
          onChange={(event) => onChange(key, fieldType === "number" ? Number(event.target.value) : event.target.value)}
          placeholder={field.description}
        />
      </div>
    );
  });
}

export function AgentActionPanel({ caseId }: { caseId: string }) {
  const { plan, loading, error, refresh, executeAction, submitInput } = useAgentPlan(caseId);
  const [activeAction, setActiveAction] = useState<AgentAction | null>(null);
  const [activeWhyAction, setActiveWhyAction] = useState<AgentAction | null>(null);
  const [actionInput, setActionInput] = useState<Record<string, unknown>>({});
  const [questionInputs, setQuestionInputs] = useState<Record<string, Record<string, unknown>>>({});

  const confidenceLabel = useMemo(() => {
    if (!plan) return "--";
    return `${Math.round(plan.confidence * 100)}%`;
  }, [plan]);

  const handleAction = async (action: AgentAction) => {
    if (action.requiresConfirmation) {
      setActiveAction(action);
      return;
    }
    const updated = await executeAction(action.id, actionInput);
    if (updated?.status) {
      toast.success(`Status updated to ${updated.status}`);
    }
  };

  const confirmAction = async () => {
    if (!activeAction) return;
    const updated = await executeAction(activeAction.id, actionInput);
    if (updated?.status) {
      toast.success(`Status updated to ${updated.status}`);
    }
    setActiveAction(null);
    setActionInput({});
  };

  const updateActionInput = (key: string, value: unknown) => {
    setActionInput((prev) => ({ ...prev, [key]: value }));
  };

  const updateQuestionInput = (questionId: string, key: string, value: unknown) => {
    setQuestionInputs((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] ?? {}),
        [key]: value,
      },
    }));
  };

  const handleQuestionSubmit = async (questionId: string) => {
    const updated = await submitInput(questionId, questionInputs[questionId] ?? {});
    if (updated?.status) {
      toast.success(`Status updated to ${updated.status}`);
    }
  };

  const fallbackReviewAction: AgentAction = useMemo(
    () => ({
      id: "send_to_human_review",
      label: "Send to human review",
      intent: "route_review",
      requiresConfirmation: true,
      inputSchema: { type: "object", properties: {} },
    }),
    []
  );

  const copyTrace = async () => {
    if (!plan?.trace) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(plan.trace, null, 2));
      toast.success("Trace copied to clipboard");
    } catch (err) {
      toast.error("Unable to copy trace");
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="sticky top-0 z-10 -mx-6 border-b border-border/60 bg-background/90 px-6 pb-3 pt-2 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">Agentic Action Panel</h3>
              <p className="text-sm text-muted-foreground">Deterministic plan for case {caseId}.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusTone[plan?.status ?? "draft"] ?? "secondary"}>
                {plan?.status ?? "draft"}
              </Badge>
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  Confidence
                  <ConfidenceHelp size={12} />
                </span>
                <span className="font-medium text-foreground">{confidenceLabel}</span>
                <span className="h-1.5 w-16 rounded-full bg-muted">
                  <span
                    className="block h-1.5 rounded-full bg-primary"
                    style={{ width: plan ? `${Math.round(plan.confidence * 100)}%` : "0%" }}
                  />
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                Refresh plan
              </Button>
            </div>
          </div>
        </div>

        {loading && !plan && (
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {!loading && !plan && !error && (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            No plan available yet. Try refreshing to load the latest recommendations.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {plan && (
          <>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-foreground">
              {plan.summary}
            </div>

            {plan.questions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Questions</h4>
                {plan.questions.map((question) => (
                  <div key={question.id} className="rounded-lg border border-border/70 bg-background p-4">
                    <p className="text-sm font-medium text-foreground">{question.prompt}</p>
                    <div className="mt-3 grid gap-3">
                      {renderSchemaFields(
                        question.inputSchema,
                        questionInputs[question.id] ?? {},
                        (key, value) => updateQuestionInput(question.id, key, value)
                      )}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleQuestionSubmit(question.id)}
                        disabled={loading}
                      >
                        Submit answer
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Answers will be used by the next action execution when required.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Recommended actions</h4>
              {plan.recommendedActions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">No recommended actions.</p>
                  <p className="mt-1">Try refreshing the plan or send this case to review.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                      Refresh plan
                    </Button>
                    <Button size="sm" onClick={() => handleAction(fallbackReviewAction)} disabled={loading}>
                      Send to review
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {plan.recommendedActions.map((action) => (
                    <div key={action.id} className="rounded-lg border border-border/70 bg-background p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={action.intent === "route_review" ? "secondary" : "default"}
                          size="sm"
                          onClick={() => handleAction(action)}
                          disabled={loading}
                        >
                          {action.label}
                        </Button>
                        {action.requiresConfirmation && (
                          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                            Confirm required
                          </Badge>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveWhyAction(action)}
                        className="mt-2 text-xs font-medium text-primary hover:underline"
                      >
                        Why?
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>

      <Dialog open={Boolean(activeAction)} onOpenChange={() => setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm action</DialogTitle>
            <DialogDescription>
              {activeAction?.label}. This action will update the case status and timeline.
            </DialogDescription>
          </DialogHeader>
          {activeAction && renderSchemaFields(activeAction.inputSchema, actionInput, updateActionInput)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAction} disabled={loading}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeWhyAction)} onOpenChange={() => setActiveWhyAction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Why this action?</DialogTitle>
            <DialogDescription>{activeWhyAction?.label}</DialogDescription>
          </DialogHeader>
          {plan && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Plan summary</p>
                <p className="mt-1 text-foreground">{plan.summary}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rules evaluated</p>
                  <Button variant="ghost" size="sm" onClick={copyTrace}>
                    Copy trace
                  </Button>
                </div>
                {plan.trace.rulesEvaluated.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No rules recorded.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border/70">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="px-3 py-2 font-semibold text-muted-foreground">Rule</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground">Outcome</th>
                          <th className="px-3 py-2 font-semibold text-muted-foreground">Evidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.trace.rulesEvaluated.map((rule) => (
                          <tr key={rule.ruleId} className="border-t border-border/60">
                            <td className="px-3 py-2 text-foreground">{rule.ruleId}</td>
                            <td className="px-3 py-2 text-foreground">{rule.outcome}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {rule.evidence?.length ? rule.evidence.join(", ") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Model notes</p>
                {plan.trace.modelNotes.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-foreground">
                    {plan.trace.modelNotes.map((note, index) => (
                      <li key={`${note}-${index}`}>{note}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No model notes recorded.</p>
                )}
              </div>

              <div className="rounded-lg border border-border/70 bg-background p-3 text-xs text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground">Trace ID:</span> {plan.trace.traceId}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-foreground">Timestamp:</span> {plan.trace.timestamp}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
