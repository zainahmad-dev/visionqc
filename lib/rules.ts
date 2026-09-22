import type { BBox, Defect, Inspection, Severity } from "./types";

// Effective value = reviewer's edit if present, else the AI's original proposal.
export function effType(d: Defect): string | null {
  return d.edited?.type ?? d.ai_type;
}

export function effSeverity(d: Defect): Severity | null {
  return d.edited?.severity ?? d.ai_severity;
}

export function effBox(d: Defect): BBox | null {
  return d.edited?.bbox ?? d.ai_bbox;
}

// threshold is a percent (0-100), matching ai_confidence (0-1) * 100.
export function isFlagged(defect: Defect, threshold: number): boolean {
  if (defect.review !== "pending") return false;
  if (defect.ai_confidence === null) return false;
  return defect.ai_confidence * 100 < threshold;
}

export function autoResult(inspection: Inspection): "pass" | "fail" {
  const activeFindings = inspection.defects.filter((d) => d.review !== "dismissed");
  return activeFindings.length > 0 ? "fail" : "pass";
}

// The result that was actually saved: the reviewer's override if they set one,
// otherwise what the findings imply.
export function finalResult(inspection: Inspection): "pass" | "fail" {
  if (inspection.result_mode === "override_pass") return "pass";
  if (inspection.result_mode === "override_fail") return "fail";
  return autoResult(inspection);
}

export function finalizeBlockers(inspection: Inspection, threshold: number): string[] {
  const blockers: string[] = [];

  const pendingFlagged = inspection.defects.filter(
    (d) => d.review === "pending" && isFlagged(d, threshold)
  );
  if (pendingFlagged.length > 0) {
    const n = pendingFlagged.length;
    blockers.push(
      `${n} finding${n === 1 ? "" : "s"} below the confidence threshold still ${n === 1 ? "needs" : "need"} review`
    );
  }

  if (inspection.result_mode !== "auto" && inspection.notes.trim().length === 0) {
    blockers.push("Add a note explaining the override before finalizing");
  }

  return blockers;
}
