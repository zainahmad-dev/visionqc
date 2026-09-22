"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Inspection, ResultMode } from "@/lib/types";
import { autoResult, finalizeBlockers } from "@/lib/rules";
import { useStore } from "@/lib/store";
import FinalizeConfirmModal from "./FinalizeConfirmModal";

const NOTES_MAX = 500;

const OPTIONS: { value: ResultMode; label: string; accent: string }[] = [
  { value: "auto", label: "Auto", accent: "var(--color-accent-cyan)" },
  { value: "override_pass", label: "Override PASS", accent: "var(--color-pass)" },
  { value: "override_fail", label: "Override FAIL", accent: "var(--color-fail)" },
];

function NotesField({ inspection }: { inspection: Inspection }) {
  const { dispatch } = useStore();
  const remaining = NOTES_MAX - inspection.notes.length;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="reviewer-notes" className="text-xs text-[var(--color-text-muted)]">
        Reviewer notes
      </label>
      <textarea
        id="reviewer-notes"
        value={inspection.notes}
        maxLength={NOTES_MAX}
        onChange={(e) => dispatch({ type: "SET_NOTES", inspectionId: inspection.id, notes: e.target.value })}
        rows={3}
        placeholder="Explain any overrides, or add context for the audit trail…"
        className="resize-y rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
      />
      <p
        className="self-end font-mono text-[11px]"
        style={{ color: remaining <= 50 ? "var(--color-review)" : "var(--color-text-muted)" }}
      >
        {inspection.notes.length}/{NOTES_MAX}
      </p>
    </div>
  );
}

function ResultControl({ inspection }: { inspection: Inspection }) {
  const { dispatch } = useStore();
  const derived = autoResult(inspection);

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-0.5 text-xs text-[var(--color-text-muted)]">Final result</legend>
      <div role="radiogroup" aria-label="Final result" className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => {
          const checked = inspection.result_mode === opt.value;
          return (
            <label
              key={opt.value}
              className="flex h-11 flex-1 min-w-[130px] cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-sm font-medium transition-colors"
              style={{
                borderColor: checked ? opt.accent : "var(--color-border-strong)",
                color: checked ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                background: checked ? "var(--color-surface-raised)" : "transparent",
              }}
            >
              <input
                type="radio"
                name={`result-mode-${inspection.id}`}
                value={opt.value}
                checked={checked}
                onChange={() => dispatch({ type: "SET_RESULT_MODE", inspectionId: inspection.id, mode: opt.value })}
                className="sr-only"
              />
              {opt.value === "auto" ? (
                <>
                  Auto —{" "}
                  <span style={{ color: derived === "pass" ? "var(--color-pass)" : "var(--color-fail)" }}>
                    {derived.toUpperCase()}
                  </span>
                </>
              ) : (
                opt.label
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function FinalizePanel({ inspection, threshold }: { inspection: Inspection; threshold: number }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const blockers = finalizeBlockers(inspection, threshold);
  const blocked = blockers.length > 0;
  const needsNote = inspection.result_mode !== "auto" && inspection.notes.trim().length === 0;

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <NotesField inspection={inspection} />
        <div className="flex flex-col gap-1.5">
          <ResultControl inspection={inspection} />
          {needsNote && (
            <p role="alert" className="text-xs text-[var(--color-review)]">
              Add a note explaining the override before finalizing.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col items-start gap-2 border-t border-[var(--color-border)] pt-4">
        <button
          type="button"
          onClick={() => {
            if (!blocked) setConfirmOpen(true);
          }}
          aria-disabled={blocked}
          aria-describedby={blocked ? "finalize-blockers" : undefined}
          title={blocked ? blockers.join(" ") : "Finalize and save this inspection"}
          className="flex h-12 items-center gap-2 rounded-[var(--radius-control)] border px-5 text-sm font-semibold transition-opacity"
          style={{
            // Blocked = a quiet, fully readable surface — never white text faded to 45%.
            background: blocked ? "var(--color-surface-raised)" : "var(--gradient-accent-strong)",
            borderColor: blocked ? "var(--color-border-strong)" : "transparent",
            color: blocked ? "var(--color-text-secondary)" : "#fff",
            cursor: blocked ? "not-allowed" : "pointer",
          }}
        >
          <CheckCircle2 size={16} />
          Finalize & Save
        </button>
        {blocked && (
          <p id="finalize-blockers" className="text-xs text-[var(--color-review)]">
            {blockers.join(" · ")}
          </p>
        )}
      </div>

      <FinalizeConfirmModal inspection={inspection} open={confirmOpen} onClose={() => setConfirmOpen(false)} />
    </div>
  );
}
