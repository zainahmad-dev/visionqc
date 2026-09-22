"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageOff, RotateCcw, TriangleAlert } from "lucide-react";
import type { Inspection } from "@/lib/types";
import { useStore, type ScanState } from "@/lib/store";
import { ERROR_REASON, TOTAL_SCAN_MS, phaseStartOffset } from "@/lib/scan";
import ScanStepper from "./ScanStepper";
import ScannerOverlay from "./ScannerOverlay";
import StatusBadge from "@/components/StatusBadge";

type Progress = { elapsedTotal: number; percent: number };

const IDLE_PROGRESS: Progress = { elapsedTotal: 0, percent: 0 };

// All clock reads live inside the effect/interval callbacks (not the render
// body) so the component itself stays a pure function of state.
function useScanProgress(scan: ScanState, active: boolean, intervalMs = 150): Progress {
  const [progress, setProgress] = useState<Progress>(IDLE_PROGRESS);

  useEffect(() => {
    if (!active || !scan) return;

    function tick() {
      const now = Date.now();
      const elapsedTotal = now - scan!.scanStartedAt;
      const overallMs = Math.min(
        TOTAL_SCAN_MS,
        phaseStartOffset(scan!.phase) + (now - scan!.phaseStartedAt)
      );
      setProgress({ elapsedTotal, percent: Math.round((overallMs / TOTAL_SCAN_MS) * 100) });
    }

    // Deferred so the first update happens in a callback, not synchronously
    // during the effect itself.
    const kickoff = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(id);
    };
  }, [active, scan, intervalMs]);

  return active ? progress : IDLE_PROGRESS;
}

export default function PreviewPanel({
  inspection,
  scan,
}: {
  inspection: Inspection | null;
  scan: ScanState;
}) {
  const { dispatch } = useStore();
  const isScanning = !!scan && inspection?.status === "scanning" && scan.inspectionId === inspection.id;
  const { elapsedTotal, percent } = useScanProgress(scan, isScanning);

  if (!inspection) {
    return (
      <div className="corner-brackets flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] text-center">
        <ImageOff size={28} className="text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">Drop or select a file to preview it here.</p>
      </div>
    );
  }

  const showSlowHint = isScanning && elapsedTotal >= 6000;

  return (
    <div className="flex flex-col gap-4">
      <div className="corner-brackets relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="relative aspect-[4/3] w-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- locally-decoded blob URLs, not a next/image candidate */}
          <img
            src={inspection.image_url}
            alt={`Preview of ${inspection.file_name}`}
            className="h-full w-full object-cover"
          />
          {isScanning && <ScannerOverlay />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-[var(--color-text-primary)]">{inspection.id}</p>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">{inspection.file_name}</p>
        </div>
        <StatusBadge status={inspection.status} />
      </div>

      {isScanning && scan && (
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <ScanStepper currentPhase={scan.phase} />
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${percent}%`, background: "var(--gradient-accent)" }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span>{(elapsedTotal / 1000).toFixed(1)}s elapsed</span>
              <span>{percent}%</span>
            </div>
          </div>
          {showSlowHint && (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              Local inference can take a while on first run.
            </p>
          )}
        </div>
      )}

      {(inspection.status === "needs_manual_review" || inspection.status === "failed") && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-review)] bg-[var(--color-review)]/10 p-4">
          <div className="flex items-start gap-2">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[var(--color-review)]" />
            <p className="text-sm text-[var(--color-text-primary)]">
              {inspection.error_code ? ERROR_REASON[inspection.error_code] : "This item needs manual review."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "RETRY", id: inspection.id })}
            className="flex h-11 w-fit items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
          >
            <RotateCcw size={15} />
            Retry
          </button>
        </div>
      )}

      {inspection.status === "analyzed" && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Category</p>
              <p className="text-[var(--color-text-primary)]">{inspection.category ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">AI Recommendation</p>
              <p
                className="font-medium capitalize"
                style={{
                  color:
                    inspection.ai_recommendation === "pass" ? "var(--color-pass)" : "var(--color-fail)",
                }}
              >
                {inspection.ai_recommendation ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Findings</p>
              <p className="text-[var(--color-text-primary)]">{inspection.defects.length}</p>
            </div>
          </div>
          <Link
            href={`/review?id=${inspection.id}`}
            className="flex h-11 w-fit items-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--gradient-accent-strong)" }}
          >
            Review Findings -&gt;
          </Link>
        </div>
      )}

      {inspection.status === "queued" && (
        <p className="text-sm text-[var(--color-text-secondary)]">Waiting in queue…</p>
      )}
    </div>
  );
}
