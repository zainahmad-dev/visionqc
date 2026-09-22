"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useStore } from "@/lib/store";
import { isFlagged } from "@/lib/rules";
import type { Inspection } from "@/lib/types";

const DEFAULT_THRESHOLD = 75;
const PRESETS = [50, 65, 75, 85, 95];

function countBelowThreshold(inspections: Inspection[], threshold: number) {
  let n = 0;
  for (const inspection of inspections) {
    for (const defect of inspection.defects) {
      if (isFlagged(defect, threshold)) n += 1;
    }
  }
  return n;
}

export default function ThresholdControl() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const flaggedCount = countBelowThreshold(state.inspections, state.threshold);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-cyan)] hover:text-[var(--color-text-primary)]"
      >
        <SlidersHorizontal size={14} />
        <span className="font-mono">{state.threshold}%</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Confidence threshold settings"
          className="absolute top-full right-0 z-40 mt-2 w-72 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-4 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Confidence threshold</p>
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_THRESHOLD", value: DEFAULT_THRESHOLD })}
              aria-label="Reset to default"
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Findings below this confidence are auto-flagged and can&apos;t be accepted silently.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <input
              type="range"
              min={50}
              max={95}
              step={1}
              value={state.threshold}
              onChange={(e) => dispatch({ type: "SET_THRESHOLD", value: Number(e.target.value) })}
              className="h-11 w-full flex-1 accent-[var(--color-accent-cyan)]"
              aria-label="Confidence threshold percent"
            />
            <span className="w-11 shrink-0 text-right font-mono text-sm text-[var(--color-text-primary)]">
              {state.threshold}%
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => dispatch({ type: "SET_THRESHOLD", value: preset })}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-xs font-medium transition-colors"
                style={{
                  borderColor: state.threshold === preset ? "var(--color-accent-cyan)" : "var(--color-border)",
                  color: state.threshold === preset ? "var(--color-accent-cyan)" : "var(--color-text-secondary)",
                }}
              >
                {preset}%
              </button>
            ))}
          </div>

          <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-text-secondary)]">
            <span className="font-mono font-medium text-[var(--color-review)]">{flaggedCount}</span> pending
            finding{flaggedCount === 1 ? "" : "s"} across all records fall below {state.threshold}%.
          </p>
        </div>
      )}
    </div>
  );
}
