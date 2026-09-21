"use client";

import { DEFECT_LABEL, SEVERITY_LABEL, type Defect, type Inspection } from "@/lib/types";
import { effSeverity, effType, isFlagged } from "@/lib/rules";

function FindingRow({
  defect,
  threshold,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: {
  defect: Defect;
  threshold: number;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}) {
  const flagged = isFlagged(defect, threshold);
  const color = flagged ? "var(--color-review)" : "var(--color-accent-cyan)";
  const type = effType(defect);
  const severity = effSeverity(defect);
  const confidencePct = defect.ai_confidence !== null ? Math.round(defect.ai_confidence * 100) : null;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        aria-pressed={isSelected}
        className="flex w-full items-stretch gap-3 rounded-[var(--radius-control)] border p-3 text-left transition-colors"
        style={{
          borderColor: isSelected ? color : "var(--color-border)",
          background: isSelected || isHovered ? "var(--color-surface-raised)" : "var(--color-surface)",
        }}
      >
        <span className="w-1 shrink-0 rounded-full" style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-medium text-[var(--color-text-primary)]">
              {type ? (DEFECT_LABEL[type] ?? type) : "Unlabeled finding"}
            </p>
            {confidencePct !== null && (
              <span className="font-mono text-xs text-[var(--color-text-secondary)]">{confidencePct}%</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
            {severity && <span className="capitalize">{SEVERITY_LABEL[severity]} severity</span>}
            {flagged && (
              <span
                className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase"
                style={{ borderColor: color, color }}
              >
                Needs Review
              </span>
            )}
            {defect.review !== "pending" && (
              <span className="capitalize text-[var(--color-text-muted)]">{defect.review}</span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

export default function FindingsListReadOnly({
  inspection,
  threshold,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  inspection: Inspection;
  threshold: number;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <div className="flex h-fit flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:sticky lg:top-20">
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
          AI Findings — Proposal Only
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Read-only for now — confirming, editing and dismissing arrive in the next pass.
        </p>
      </div>

      {inspection.defects.length === 0 ? (
        <p className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
          No AI findings on this record. Findings can still be recorded manually once editing tools are
          available.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {inspection.defects.map((defect) => (
            <FindingRow
              key={defect.id}
              defect={defect}
              threshold={threshold}
              isSelected={defect.id === selectedId}
              isHovered={defect.id === hoveredId}
              onSelect={() => onSelect(defect.id === selectedId ? null : defect.id)}
              onHover={(hovering) => onHover(hovering ? defect.id : null)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
