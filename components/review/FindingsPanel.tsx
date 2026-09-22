"use client";

import { CircleAlert } from "lucide-react";
import { CATEGORIES } from "@/lib/mock";
import type { Inspection, Review } from "@/lib/types";
import { useStore } from "@/lib/store";
import ConfidenceGauge from "./ConfidenceGauge";
import DefectCard from "./DefectCard";
import RawOutputCard from "./RawOutputCard";

const COUNTER_ORDER: Review[] = ["confirmed", "edited", "dismissed", "reviewer_added"];
const COUNTER_LABEL: Record<Review, string> = {
  pending: "pending",
  confirmed: "confirmed",
  edited: "edited",
  dismissed: "dismissed",
  reviewer_added: "added",
};

function CategoryRow({ inspection }: { inspection: Inspection }) {
  const { dispatch } = useStore();
  const value = inspection.reviewer_category ?? inspection.category ?? "";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="reviewer-category" className="text-xs text-[var(--color-text-muted)]">
        Category
      </label>
      <select
        id="reviewer-category"
        value={value}
        onChange={(e) =>
          dispatch({ type: "SET_REVIEWER_CATEGORY", inspectionId: inspection.id, category: e.target.value })
        }
        className="h-11 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-2 text-sm text-[var(--color-text-primary)]"
      >
        <option value="" disabled>
          Select a category
        </option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      <p className="text-xs text-[var(--color-text-secondary)]">
        AI:{" "}
        {inspection.category
          ? `${inspection.category} ${Math.round((inspection.category_confidence ?? 0) * 100)}%`
          : "No category proposed"}
      </p>
    </div>
  );
}

function RecommendationRow({ inspection }: { inspection: Inspection }) {
  if (inspection.category_confidence === null || inspection.ai_recommendation === null) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-review)] bg-[var(--color-review)]/10 px-3 py-2 text-xs text-[var(--color-text-primary)]">
        <CircleAlert size={14} className="shrink-0 text-[var(--color-review)]" />
        No AI recommendation available for this record.
      </div>
    );
  }

  const pass = inspection.ai_recommendation === "pass";
  const color = pass ? "var(--color-pass)" : "var(--color-fail)";

  return (
    <div className="flex items-center gap-3">
      <ConfidenceGauge confidence={inspection.category_confidence} />
      <div className="flex flex-col gap-1">
        <span className="text-xs text-[var(--color-text-muted)]">Overall AI confidence</span>
        <span
          className="w-fit rounded-full border px-2.5 py-1 text-xs font-semibold tracking-wide uppercase"
          style={{ borderColor: color, color }}
        >
          AI recommends {inspection.ai_recommendation}
        </span>
      </div>
    </div>
  );
}

export default function FindingsPanel({
  inspection,
  threshold,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  bare = false,
}: {
  inspection: Inspection;
  threshold: number;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  bare?: boolean; // inside the mobile sheet, which is already the card
}) {
  const counts = COUNTER_ORDER.map((review) => ({
    review,
    n: inspection.defects.filter((d) => d.review === review).length,
  }));

  return (
    <div
      className={
        bare
          ? "flex flex-col gap-4"
          : "flex h-fit flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 lg:sticky lg:top-20"
      }
    >
      <p className="text-xs font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
        AI Findings — Proposal Only
      </p>

      <CategoryRow inspection={inspection} />
      <RecommendationRow inspection={inspection} />

      {inspection.defects.length === 0 ? (
        <p className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
          No AI findings on this record. Findings can still be recorded manually once editing tools are
          available.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {inspection.defects.map((defect) => (
            <DefectCard
              key={defect.id}
              inspectionId={inspection.id}
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

      <RawOutputCard rawOutput={inspection.raw_output} />

      {inspection.defects.length > 0 && (
        <p className="font-mono text-xs text-[var(--color-text-secondary)]">
          {counts.map((c, i) => (
            <span key={c.review}>
              {i > 0 && " - "}
              {c.n} {COUNTER_LABEL[c.review]}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
