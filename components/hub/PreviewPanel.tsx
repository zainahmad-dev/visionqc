"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageOff, RotateCcw, TriangleAlert } from "lucide-react";
import type { Inspection } from "@/lib/types";
import { useStore, type ScanState } from "@/lib/store";
import { ERROR_REASON } from "@/lib/scan";
import ScanStepper from "./ScanStepper";
import ScannerOverlay from "./ScannerOverlay";
import StatusBadge from "@/components/StatusBadge";

// Real inference has no predictable duration (CPU vs. GPU alone is a 10x
// swing), so there's no honest percentage to show — just how long it's
// actually been running. All clock reads live inside the interval callback
// (not the render body) so the component itself stays a pure function of state.
function useElapsed(scan: ScanState, active: boolean, intervalMs = 200): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active || !scan) return;
    const tick = () => setElapsed(Date.now() - scan!.scanStartedAt);
    // Deferred so the first update happens in a callback, not synchronously
    // during the effect itself.
    const kickoff = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, intervalMs);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(id);
    };
  }, [active, scan, intervalMs]);

  return active ? elapsed : 0;
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
  const elapsedTotal = useElapsed(scan, isScanning);

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
            {/* Indeterminate, not a percentage: real inference has no
                predictable duration to measure progress against. */}
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]"
              role="progressbar"
              aria-label="Scan in progress"
            >
              <div className="indeterminate-bar h-full w-1/3 rounded-full" style={{ background: "var(--gradient-accent)" }} />
            </div>
            <p className="mt-1.5 text-xs text-[var(--color-text-secondary)]">{(elapsedTotal / 1000).toFixed(1)}s elapsed</p>
          </div>
          {showSlowHint && (
            <p className="mt-3 text-xs text-[var(--color-text-muted)]">
              Local inference on CPU can take a minute or more — this is normal, not stuck.
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
