"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { BROKEN_JSON_SAMPLE, errorResult, type ScanPhase } from "@/lib/scan";
import { takeUploadedFile } from "@/lib/image-cache";
import type { Inspection } from "@/lib/types";

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("aborted", "AbortError"));
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

type StreamEvent = { type: "phase"; phase: ScanPhase } | { type: "done"; result: Partial<Inspection> };

// Next task/paint boundary — not a delay (0ms), just a guarantee that a
// dispatch made just before this actually gets committed and drawn. Without
// it, "validating" (a JSON.parse + Zod check, sub-millisecond for real
// inference) can be superseded by the terminal result before React ever
// paints it, so the reviewer never sees the stepper's third step light up.
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// Reads the NDJSON body of POST /api/analyze, calling onPhase for each stage
// line as it arrives and returning the terminal result. Real network progress,
// not a fixed timer — a stage can legitimately take anywhere from under a
// second to well over a minute on CPU-only inference.
async function readAnalyzeStream(
  res: Response,
  onPhase: (phase: ScanPhase) => void
): Promise<Partial<Inspection>> {
  if (!res.body) throw new Error("no response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: Partial<Inspection> | null = null;

  outer: for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineAt: number;
    while ((newlineAt = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineAt);
      buffer = buffer.slice(newlineAt + 1);
      if (!line.trim()) continue;
      const event = JSON.parse(line) as StreamEvent;
      if (event.type === "phase") {
        onPhase(event.phase);
        await nextFrame();
      } else {
        result = event.result;
        break outer; // the terminal event — whatever's left in the buffer is nothing
      }
    }
  }

  if (!result) throw new Error("stream ended without a result");
  return result;
}

// No UI. Mounted once above the router so a scan keeps running (and its
// analysis request keeps going) no matter what page is showing.
export default function ScanEngine() {
  const { state, dispatch } = useStore();
  const scanId = state.scan?.inspectionId ?? null;
  const simulateInvalidJson = state.scan?.simulateInvalidJson ?? false;

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

  // Run the active scan. Deliberately keyed on just the id + the one flag
  // fixed at SCAN_START — not on `state.scan` itself, which changes shape on
  // every SCAN_PHASE this same effect dispatches; depending on the whole
  // object would restart the request from scratch on its own progress.
  useEffect(() => {
    if (!scanId) return;
    const controller = new AbortController();

    function finish(result: Partial<Inspection>) {
      dispatch({ type: "SCAN_DONE", id: scanId!, result });
      if (result.error_code) {
        dispatch({
          type: "TOAST",
          message: `${scanId} needs manual review — the model's output couldn't be used.`,
          tone: "warning",
          action: { label: "Open", href: "/hub", focusId: scanId! },
        });
      } else {
        dispatch({
          type: "TOAST",
          message: `Analysis complete - ${scanId}`,
          tone: "success",
          action: { label: "Review Findings ->", href: `/review?id=${scanId}` },
        });
      }
    }

    async function run() {
      // The dev-only "Simulate invalid JSON" toggle: a short, entirely local
      // stand-in for the Needs Manual Review path, never touching Ollama.
      if (simulateInvalidJson) {
        dispatch({ type: "SCAN_PHASE", id: scanId!, phase: "analyzing" });
        await sleep(700, controller.signal);
        dispatch({ type: "SCAN_PHASE", id: scanId!, phase: "validating" });
        await sleep(400, controller.signal);
        finish(errorResult("invalid_json", BROKEN_JSON_SAMPLE));
        return;
      }

      const file = takeUploadedFile(scanId!);
      if (!file) {
        // Shouldn't happen in normal use (the file is cached synchronously at
        // upload time, before this can ever run) — fails safely rather than
        // hanging forever if it somehow does.
        finish(errorResult("corrupt_image", null));
        return;
      }

      const formData = new FormData();
      formData.append("image", file);
      formData.append("inspectionId", scanId!);

      try {
        const res = await fetch("/api/analyze", { method: "POST", body: formData, signal: controller.signal });
        if (!res.ok) throw new Error(`/api/analyze responded ${res.status}`);
        const result = await readAnalyzeStream(res, (phase) => dispatch({ type: "SCAN_PHASE", id: scanId!, phase }));
        finish(result);
      } catch (err) {
        if (controller.signal.aborted) return; // this scan was superseded/unmounted — nothing to report
        console.error("Scan failed:", err);
        finish(errorResult("timeout", null));
      }
    }

    void run();
    // Aborts the in-flight request (and any pending sleep) if this scan is
    // superseded — including React Strict Mode's dev-only double-invoke,
    // which would otherwise fire two real Ollama calls per scan.
    return () => controller.abort();
  }, [scanId, simulateInvalidJson, dispatch]);

  return null;
}
