"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import {
  BROKEN_JSON_SAMPLE,
  PHASE_DURATION_MS,
  checkImageDecodes,
  errorResult,
  generateAnalysis,
} from "@/lib/scan";

// No UI. Mounted once above the router so a scan keeps running (and its
// timers keep counting from real timestamps) no matter what page is showing.
export default function ScanEngine() {
  const { state, dispatch } = useStore();
  const decodeCache = useRef(new Map<string, Promise<boolean>>());

  // Idle and something is queued? Start it, one at a time, oldest first.
  useEffect(() => {
    if (state.scan) return;
    const next = [...state.inspections]
      .filter((i) => i.status === "queued")
      .sort((a, b) => a.created_at - b.created_at)[0];
    if (!next) return;
    dispatch({ type: "SCAN_START", id: next.id });
    dispatch({ type: "SET_ACTIVE_HUB", id: next.id });
  }, [state.scan, state.inspections, dispatch]);

  // Drive the active scan's stage timing.
  useEffect(() => {
    const scan = state.scan;
    if (!scan) return;

    if (scan.phase === "ingesting" && !decodeCache.current.has(scan.inspectionId)) {
      const inspection = state.inspections.find((i) => i.id === scan.inspectionId);
      if (inspection) {
        decodeCache.current.set(scan.inspectionId, checkImageDecodes(inspection.image_url));
      }
    }

    const elapsed = Date.now() - scan.phaseStartedAt;
    const remaining = Math.max(0, PHASE_DURATION_MS[scan.phase] - elapsed);
    let cancelled = false;

    const timer = window.setTimeout(() => {
      void (async () => {
        if (scan.phase === "ingesting") {
          const decodeOk = await (decodeCache.current.get(scan.inspectionId) ?? Promise.resolve(true));
          if (cancelled) return;
          if (!decodeOk) {
            dispatch({ type: "SCAN_DONE", id: scan.inspectionId, result: errorResult("corrupt_image", null) });
            dispatch({
              type: "TOAST",
              message: `${scan.inspectionId} needs manual review — the image failed to decode.`,
              tone: "warning",
              action: { label: "Open", href: "/hub", focusId: scan.inspectionId },
            });
            return;
          }
          dispatch({ type: "SCAN_PHASE", id: scan.inspectionId, phase: "analyzing" });
        } else if (scan.phase === "analyzing") {
          dispatch({ type: "SCAN_PHASE", id: scan.inspectionId, phase: "validating" });
        } else if (scan.simulateInvalidJson) {
          dispatch({
            type: "SCAN_DONE",
            id: scan.inspectionId,
            result: errorResult("invalid_json", BROKEN_JSON_SAMPLE),
          });
          dispatch({
            type: "TOAST",
            message: `${scan.inspectionId} needs manual review — the model returned invalid JSON.`,
            tone: "warning",
            action: { label: "Open", href: "/hub", focusId: scan.inspectionId },
          });
        } else {
          dispatch({ type: "SCAN_DONE", id: scan.inspectionId, result: generateAnalysis() });
          dispatch({
            type: "TOAST",
            message: `Analysis complete - ${scan.inspectionId}`,
            tone: "success",
            action: { label: "Review Findings ->", href: `/review?id=${scan.inspectionId}` },
          });
        }
      })();
    }, remaining);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state.scan, state.inspections, dispatch]);

  return null;
}
