import { AlertTriangle } from "lucide-react";
import React from "react";

import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type ErrorStateProps = {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-destructive", className)}>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4" />
        {title}
      </div>
      {description && <p className="text-sm text-destructive/80">{description}</p>}
      {onRetry && (
        <Button variant="destructive" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}
