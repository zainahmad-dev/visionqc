"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { isFlagged } from "@/lib/rules";
import { useMediaQuery } from "@/lib/use-media-query";
import { useFocusMainOnChange } from "@/components/RouteFocus";
import type { Inspection, Status } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";
import ReviewCanvas from "@/components/ReviewCanvas";
import RecordPicker from "@/components/review/RecordPicker";
import BottomSheet, { SHEET_PEEK_PX } from "@/components/review/BottomSheet";
import FindingsPanel from "@/components/review/FindingsPanel";
import FinalizePanel from "@/components/review/FinalizePanel";

// Everything a reviewer might still need to act on — scanned, broken, or
// stuck. Queued/scanning have no output yet; completed is already done.
const REVIEWABLE: Status[] = ["analyzed", "needs_manual_review", "failed"];

// Keyed by inspection id from the parent, so switching records remounts this
// (and its selection state) fresh instead of resetting it via an effect.
function ReviewRecordView({ inspection, threshold }: { inspection: Inspection; threshold: number }) {
  const [selectedDefectId, setSelectedDefectId] = useState<string | null>(null);
  const [hoveredDefectId, setHoveredDefectId] = useState<string | null>(null);
  // Side by side from lg up; below that the findings become a bottom sheet.
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);

  const flagged = inspection.defects.filter((d) => isFlagged(d, threshold)).length;
  const count = inspection.defects.length;
  const findingsPanel = (bare: boolean) => (
    <FindingsPanel
      inspection={inspection}
      threshold={threshold}
      selectedId={selectedDefectId}
      hoveredId={hoveredDefectId}
      onSelect={setSelectedDefectId}
      onHover={setHoveredDefectId}
      bare={bare}
    />
  );

  return (
    // Below lg the sheet's peek bar floats over the bottom of the page, so leave room for it.
    <div className="flex flex-col gap-6" style={isDesktop ? undefined : { paddingBottom: SHEET_PEEK_PX }}>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/review"
          aria-label="Back to record picker"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-cyan)] hover:text-[var(--color-text-primary)]"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-mono text-lg text-[var(--color-text-primary)]">{inspection.id}</p>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">{inspection.file_name}</p>
        </div>
        <StatusBadge status={inspection.status} className="ml-auto" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ReviewCanvas
          inspection={inspection}
          threshold={threshold}
          selectedDefectId={selectedDefectId}
          hoveredDefectId={hoveredDefectId}
          onSelectDefect={setSelectedDefectId}
          onHoverDefect={setHoveredDefectId}
        />
        {isDesktop && findingsPanel(false)}
      </div>

      <FinalizePanel inspection={inspection} threshold={threshold} />

      {!isDesktop && (
        <BottomSheet
          label="AI findings"
          summary={
            <span className="flex flex-wrap items-center gap-x-2">
              <span>
                AI findings · {count} {count === 1 ? "finding" : "findings"}
              </span>
              {flagged > 0 && (
                <span className="inline-flex items-center gap-1 text-[var(--color-review)]">
                  <TriangleAlert size={12} aria-hidden="true" />
                  {flagged} below threshold
                </span>
              )}
            </span>
          }
        >
          {findingsPanel(true)}
        </BottomSheet>
      )}
    </div>
  );
}

function ReviewPageInner() {
  const { state } = useStore();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  useFocusMainOnChange(id); // picker ⇄ record swaps content on the same path

  const reviewable = [...state.inspections]
    .filter((i) => REVIEWABLE.includes(i.status))
    .sort((a, b) => b.created_at - a.created_at);

  // Looked up across every inspection, not just `reviewable` — Finalize
  // flips status to "completed" while its confirm modal is still animating
  // on this same page, and the record being viewed shouldn't vanish out
  // from under that modal mid-sequence.
  const selected = id ? (state.inspections.find((i) => i.id === id) ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Review</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Confirm, edit, or dismiss AI-proposed defects before anything is saved.
        </p>
      </div>

      {!selected ? (
        <>
          {id && (
            <p className="rounded-[var(--radius-control)] border border-[var(--color-review)] bg-[var(--color-review)]/10 px-3 py-2 text-sm text-[var(--color-text-primary)]">
              {id} isn&apos;t waiting for review — pick a record below.
            </p>
          )}
          <RecordPicker items={reviewable} />
        </>
      ) : (
        <ReviewRecordView key={selected.id} inspection={selected} threshold={state.threshold} />
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewPageInner />
    </Suspense>
  );
}
