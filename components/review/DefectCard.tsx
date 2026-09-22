"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, Check, Pencil } from "lucide-react";
import { DEFECT_LABEL, SEVERITY_LABEL, type Defect, type Review, type Severity } from "@/lib/types";
import { effSeverity, effType, isFlagged } from "@/lib/rules";
import { useStore } from "@/lib/store";

const REVIEW_STATUS_WORD: Record<Review, string> = {
  pending: "pending",
  confirmed: "confirmed",
  edited: "edited",
  dismissed: "dismissed",
  reviewer_added: "added",
};

function labelFor(type: string | null): string {
  if (!type) return "Unlabeled";
  return DEFECT_LABEL[type] ?? type;
}

function EditForm({
  defect,
  onCancel,
  onSave,
}: {
  defect: Defect;
  onCancel: () => void;
  onSave: (edits: { type: string; severity: Severity }) => void;
}) {
  const [type, setType] = useState(effType(defect) ?? Object.keys(DEFECT_LABEL)[0]);
  const [severity, setSeverity] = useState<Severity>(effSeverity(defect) ?? "low");

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          Type
          <select
            autoFocus // the user just asked to edit: land in the form, not on the button that vanished
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-2 text-sm text-[var(--color-text-primary)]"
          >
            {Object.entries(DEFECT_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            className="h-11 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-2 text-sm text-[var(--color-text-primary)]"
          >
            {Object.entries(SEVERITY_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave({ type, severity })}
          className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--gradient-accent-strong)" }}
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function DefectCard({
  inspectionId,
  defect,
  threshold,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: {
  inspectionId: string;
  defect: Defect;
  threshold: number;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}) {
  const { dispatch } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // The form's buttons unmount on Save/Cancel, which would drop focus on <body>;
  // put it back on the control that opened the form.
  useEffect(() => {
    if (wasEditing.current && !isEditing) editButtonRef.current?.focus();
    wasEditing.current = isEditing;
  }, [isEditing]);

  const flagged = isFlagged(defect, threshold);
  const dismissed = defect.review === "dismissed";
  const accent = flagged ? "var(--color-review)" : "var(--color-accent-cyan)";

  const aiLabel = labelFor(defect.ai_type);
  const aiConfidencePct = defect.ai_confidence !== null ? Math.round(defect.ai_confidence * 100) : null;
  const reviewedLabel = labelFor(effType(defect));
  const severity = effSeverity(defect);

  function handleDismiss() {
    dispatch({ type: "DEFECT_DISMISS", inspectionId, defectId: defect.id });
    dispatch({
      type: "TOAST",
      message: `${reviewedLabel} dismissed as a false positive.`,
      tone: "info",
      action: {
        label: "Undo",
        onAction: () => {
          dispatch({ type: "DEFECT_RESTORE", inspectionId, defectId: defect.id });
          dispatch({ type: "ANNOUNCE", message: `${reviewedLabel} restored.` });
        },
      },
    });
  }

  return (
    <li>
      <div
        className="rounded-[var(--radius-card)] border-l-4 border-y border-r p-3 transition-colors"
        style={{
          borderLeftColor: dismissed ? "var(--color-border-strong)" : accent,
          borderTopColor: "var(--color-border)",
          borderBottomColor: "var(--color-border)",
          borderRightColor: "var(--color-border)",
          background: isSelected || isHovered ? "var(--color-surface-raised)" : "var(--color-surface)",
          // A dismissed finding is marked by its strikethrough, grey edge and the
          // word "dismissed" — never by fading the text, which drops it under 4.5:1.
        }}
      >
        <button
          type="button"
          onClick={onSelect}
          onMouseEnter={() => onHover(true)}
          onMouseLeave={() => onHover(false)}
          onFocus={() => onHover(true)}
          onBlur={() => onHover(false)}
          aria-pressed={isSelected}
          className="flex w-full flex-col gap-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`font-mono text-sm font-medium text-[var(--color-text-primary)] ${dismissed ? "line-through" : ""}`}
            >
              {reviewedLabel}
            </p>
            {severity && (
              <span className="text-xs text-[var(--color-text-secondary)]">{SEVERITY_LABEL[severity]}</span>
            )}
          </div>
          <p className={`text-xs text-[var(--color-text-secondary)] ${dismissed ? "line-through" : ""}`}>
            {defect.ai_type === null
              ? "AI: no value — added by reviewer"
              : `AI: ${aiLabel} ${aiConfidencePct !== null ? `${aiConfidencePct}%` : "—"}`}
          </p>
          <p className={`text-xs text-[var(--color-text-secondary)] ${dismissed ? "line-through" : ""}`}>
            Reviewed: {reviewedLabel} ({REVIEW_STATUS_WORD[defect.review]})
          </p>
        </button>

        {flagged && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${aiConfidencePct ?? 0}%`, background: "var(--color-review)" }}
              />
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-review)]">
              Below the {threshold}% threshold — you must confirm, edit or dismiss this finding.
            </p>
          </div>
        )}

        {isEditing ? (
          <EditForm
            defect={defect}
            onCancel={() => setIsEditing(false)}
            onSave={(edits) => {
              dispatch({ type: "DEFECT_EDIT", inspectionId, defectId: defect.id, edits });
              setIsEditing(false);
            }}
          />
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: "DEFECT_CONFIRM", inspectionId, defectId: defect.id })}
              className="flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-pass)] hover:text-[var(--color-pass)]"
            >
              <Check size={13} />
              Confirm
            </button>
            <button
              ref={editButtonRef}
              type="button"
              onClick={() => setIsEditing(true)}
              className="flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
            >
              <Pencil size={13} />
              Edit
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-fail)] hover:text-[var(--color-fail)]"
            >
              <Ban size={13} />
              Dismiss as False Positive
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
