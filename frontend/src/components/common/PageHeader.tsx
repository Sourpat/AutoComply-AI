import { motion } from "framer-motion";
import React from "react";

import { cn } from "../../lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn("flex flex-col gap-4 md:flex-row md:items-center md:justify-between", className)}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground md:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
