import { motion } from "framer-motion";
import React from "react";

import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/50 px-6 py-10 text-center",
        className
      )}
    >
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>}
      {actionLabel && onAction && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
