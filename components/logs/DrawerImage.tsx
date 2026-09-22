"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { DEFECT_LABEL, type Inspection } from "@/lib/types";
import { effBox, effType } from "@/lib/rules";
import { finalFindings } from "@/lib/logs";

const MAX_HEIGHT = 280; // px

// The inspection image with its FINAL boxes drawn on — read-only. Dismissed
// findings aren't drawn (the reviewer ruled them out). Numbers match the
// Findings tab. Solid box = as the AI proposed it; dashed = edited or added.
//
// If the image is unavailable, the boxes are drawn on a blank hairline frame
// rather than dropped — the geometry is still part of the record. Keyed by
// inspection id by the parent, so switching records resets the load state.
export default function DrawerImage({ inspection }: { inspection: Inspection }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; ratio: number }>({
    status: "loading",
    ratio: 4 / 3,
  });

  const findings = finalFindings(inspection);

  return (
    <figure className="flex flex-col gap-2">
      {/* Height-capped so the tabs stay near the fold: the width shrinks with
          the ratio (never the height alone), so the % boxes stay true. */}
      <div
        className="corner-brackets relative mx-auto overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-bg)]"
        style={{ aspectRatio: state.ratio, width: `min(100%, ${MAX_HEIGHT * state.ratio}px)` }}
      >
        {state.status === "error" && (
          <div className="bg-hairline-grid absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <ImageOff size={24} className="text-[var(--color-text-muted)]" aria-hidden="true" />
            <p className="max-w-52 rounded bg-[var(--color-bg)]/80 px-2 py-1 text-xs text-[var(--color-text-secondary)]">
              Image unavailable — boxes are drawn on a blank frame.
            </p>
          </div>
        )}

        {state.status !== "error" && (
          // eslint-disable-next-line @next/next/no-img-element -- locally-decoded blob or mock URL, may 404
          <img
            src={inspection.image_url}
            alt={`${inspection.file_name} with ${findings.length} final ${findings.length === 1 ? "finding" : "findings"} marked`}
            className="absolute inset-0 h-full w-full"
            style={{ opacity: state.status === "ready" ? 1 : 0 }}
            onLoad={(e) => {
              const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
              setState({ status: "ready", ratio: w > 0 && h > 0 ? w / h : 4 / 3 });
            }}
            onError={() => setState({ status: "error", ratio: 4 / 3 })}
          />
        )}

        {/* Decorative overlay — every box is described in the Findings tab. */}
        <div className="absolute inset-0" aria-hidden="true">
          {findings.map((defect, index) => {
            const box = effBox(defect);
            if (!box) return null;
            const changed = defect.review === "edited" || defect.review === "reviewer_added";
            const type = effType(defect);
            return (
              <div
                key={defect.id}
                title={`${index + 1}. ${type ? (DEFECT_LABEL[type] ?? type) : "Unlabeled"}`}
                className="absolute"
                style={{
                  left: `${box.x * 100}%`,
                  top: `${box.y * 100}%`,
                  width: `${box.w * 100}%`,
                  height: `${box.h * 100}%`,
                  border: `2px ${changed ? "dashed" : "solid"} ${changed ? "var(--color-accent-indigo)" : "var(--color-accent-cyan)"}`,
                  background: `color-mix(in srgb, ${changed ? "var(--color-accent-indigo)" : "var(--color-accent-cyan)"} 12%, transparent)`,
                }}
              >
                <span
                  className="absolute -top-2.5 -left-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-mono text-[11px] font-semibold text-white"
                  style={{ background: changed ? "var(--color-accent-indigo)" : "var(--color-accent-cyan)" }}
                >
                  {index + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <figcaption className="text-[11px] text-[var(--color-text-muted)]">
        Solid = as proposed · Dashed = edited or added by reviewer · Dismissed findings are not drawn.
      </figcaption>
    </figure>
  );
}
