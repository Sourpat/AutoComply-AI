import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const BODY_TEXT =
  "Confidence is a calibrated estimate of how likely the decision is correct, based on available inputs and rules. It is not certainty, and it can change if evidence or specs change.";
const FOOTER_TEXT = "Always review flagged cases and overrides.";

export function ConfidenceHelp({ className, size = 14 }: { className?: string; size?: number }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !tooltipRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const gutter = 12;
    let left = rect.left;
    const maxLeft = window.innerWidth - gutter - tooltipRect.width;
    if (left > maxLeft) left = maxLeft;
    if (left < gutter) left = gutter;

    let top = rect.bottom + 8;
    const maxTop = window.innerHeight - gutter - tooltipRect.height;
    if (top > maxTop) {
      top = rect.top - tooltipRect.height - 8;
    }

    setCoords({ top, left });
  }, [open]);

  return (
    <span
      className={`relative inline-flex ${className ?? ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Confidence help"
        onClick={() => setOpen((prev) => !prev)}
        onFocus={() => setOpen(true)}
        onBlur={close}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <Info size={size} />
      </button>
      {open && createPortal(
        <div
          role="tooltip"
          ref={tooltipRef}
          className="fixed z-50 w-[260px] rounded-lg border border-border/70 bg-background p-3 text-xs text-muted-foreground shadow-lg"
          style={{ top: coords?.top ?? 0, left: coords?.left ?? 0 }}
        >
          <p className="text-xs font-semibold text-foreground">Confidence</p>
          <p className="mt-1 text-[11px] leading-relaxed">{BODY_TEXT}</p>
          <p className="mt-2 text-[10px] text-muted-foreground">{FOOTER_TEXT}</p>
        </div>,
        document.body
      )}
    </span>
  );
}
