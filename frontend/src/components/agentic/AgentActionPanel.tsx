import React, { useMemo, useState } from "react";

import type { AgentAction, AgentPlan, JSONSchema } from "../../contracts/agentic";
import { useAgentPlan } from "../../hooks/useAgentPlan";
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
    await executeAction(action.id, actionInput);
  };

  const confirmAction = async () => {
    if (!activeAction) return;
    await executeAction(activeAction.id, actionInput);
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

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Agentic Action Panel</h3>
            <p className="text-sm text-muted-foreground">Deterministic plan for case {caseId}.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusTone[plan?.status ?? "draft"] ?? "secondary"}>
              {plan?.status ?? "draft"}
            </Badge>
            <Badge variant="secondary">Confidence {confidenceLabel}</Badge>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              Refresh plan
            </Button>
          </div>
        </div>

        {loading && !plan && (
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
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
                        onClick={() =>
                          submitInput(question.id, questionInputs[question.id] ?? {})
                        }
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
              <div className="flex flex-wrap gap-2">
                {plan.recommendedActions.map((action) => (
                  <Button
                    key={action.id}
                    variant={action.intent === "route_review" ? "secondary" : "default"}
                    size="sm"
                    onClick={() => handleAction(action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>

            <details className="rounded-lg border border-border/70 bg-background p-4">
              <summary className="cursor-pointer text-sm font-medium text-foreground">View trace</summary>
              <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                {JSON.stringify(plan.trace, null, 2)}
              </pre>
            </details>
          </>
        )}
      </CardContent>

      <Dialog open={Boolean(activeAction)} onOpenChange={() => setActiveAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm action</DialogTitle>
            <DialogDescription>
              {activeAction?.label}
            </DialogDescription>
          </DialogHeader>
          {activeAction && renderSchemaFields(activeAction.inputSchema, actionInput, updateActionInput)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>
              Cancel
            </Button>
            <Button onClick={confirmAction}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
