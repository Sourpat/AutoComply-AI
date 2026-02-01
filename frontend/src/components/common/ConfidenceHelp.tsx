import React, { useCallback, useState } from "react";
import { Info } from "lucide-react";

const BODY_TEXT =
  "Confidence is a calibrated estimate of how likely the decision is correct, based on available inputs and rules. It is not certainty, and it can change if evidence or specs change.";
const FOOTER_TEXT = "Always review flagged cases and overrides.";

export function ConfidenceHelp({ className, size = 14 }: { className?: string; size?: number }) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  return (
    <span
      className={`relative inline-flex ${className ?? ""}`}
      onMouseLeave={close}
    >
      <button
        type="button"
        aria-label="Confidence help"
        onClick={() => setOpen((prev) => !prev)}
        onFocus={() => setOpen(true)}
        onBlur={close}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <Info size={size} />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-lg border border-border/70 bg-background p-3 text-xs text-muted-foreground shadow-lg"
        >
          <p className="text-xs font-semibold text-foreground">Confidence</p>
          <p className="mt-1 text-[11px] leading-relaxed">{BODY_TEXT}</p>
          <p className="mt-2 text-[10px] text-muted-foreground">{FOOTER_TEXT}</p>
        </div>
      )}
    </span>
  );
}
