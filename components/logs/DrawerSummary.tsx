"use client";

import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";
import type { Inspection } from "@/lib/types";
import { ERROR_REASON } from "@/lib/scan";
import { RESULT_LABEL, effCategory, logResult } from "@/lib/logs";
import { useStore } from "@/lib/store";
import StatusBadge from "@/components/StatusBadge";
import ConfidenceBadge from "./ConfidenceBadge";
import ResultBadge from "./ResultBadge";

function Side({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 p-3">
      <span className="text-[10px] font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
        {heading}
      </span>
      {children}
    </div>
  );
}

// Result pill, then what the AI proposed beside what the reviewer settled on —
// the AI's values are never overwritten, so both are always shown.
function Verdict({ inspection, threshold }: { inspection: Inspection; threshold: number }) {
  const result = logResult(inspection);
  const saved = inspection.status === "completed";
  const ai = inspection.ai_recommendation;
  const overridden = saved && inspection.result_mode !== "auto";
  const categoryEdited =
    inspection.category !== null && inspection.reviewer_category !== inspection.category;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ResultBadge result={result} size="lg" />
        <StatusBadge status={inspection.status} />
      </div>

      <div className="grid grid-cols-1 divide-y divide-[var(--color-border)] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Side heading="AI proposed">
          <p className="font-mono text-sm text-[var(--color-text-primary)]">
            AI: {ai ? RESULT_LABEL[ai] : "no recommendation"}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {inspection.category
              ? `Category: ${inspection.category} ${Math.round((inspection.category_confidence ?? 0) * 100)}%`
              : "Category: none proposed"}
          </p>
        </Side>
        <Side heading="Reviewed">
          <p className="font-mono text-sm text-[var(--color-text-primary)]">
            Reviewed: {saved ? RESULT_LABEL[result] : "not reviewed yet"}
            {overridden && " (override)"}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Category: {effCategory(inspection) ?? "—"}
            {categoryEdited && <span className="text-[var(--color-indigo-text)]"> (edited)</span>}
          </p>
        </Side>
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
        Overall AI confidence
        <ConfidenceBadge value={inspection.category_confidence} threshold={threshold} />
      </div>
    </div>
  );
}

// Rule 3: a broken record keeps its visible reason and a Retry — nothing is
// discarded. Retry re-queues the scan (it leaves the log until it settles again).
function Unresolved({ inspection, onClose }: { inspection: Inspection; onClose: () => void }) {
  const { dispatch } = useStore();

  function handleRetry() {
    dispatch({ type: "RETRY", id: inspection.id });
    dispatch({
      type: "TOAST",
      message: `${inspection.id} re-queued for another scan.`,
      tone: "info",
      action: { label: "Open Hub", href: "/hub" },
    });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-review)] bg-[var(--color-review)]/10 p-3">
      <div className="flex items-start gap-2">
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[var(--color-review)]" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-primary)]">
          {inspection.error_code
            ? ERROR_REASON[inspection.error_code]
            : "This record needs a manual look before it can be saved."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleRetry}
          className="flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--gradient-accent-strong)" }}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Retry
        </button>
        <Link
          href={`/review?id=${inspection.id}`}
          className="flex h-11 items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
        >
          Open in Review
        </Link>
      </div>
    </div>
  );
}

export default function DrawerSummary({
  inspection,
  threshold,
  onClose,
}: {
  inspection: Inspection;
  threshold: number;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Verdict inspection={inspection} threshold={threshold} />
      {inspection.status !== "completed" && <Unresolved inspection={inspection} onClose={onClose} />}
    </div>
  );
}
