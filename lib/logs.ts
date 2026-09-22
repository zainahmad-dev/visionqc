// Pure logic for the Logs page — which records belong, how they filter and
// sort, and how times are formatted. No React, so it's easy to reason about.

import { effType, finalResult } from "./rules";
import type { Defect, ErrorCode, Inspection, Status } from "./types";

// ---------------------------------------------------------------------------
// Which records the log shows
// ---------------------------------------------------------------------------

// Settled records only: saved ("completed") or stuck with a visible reason
// (needs_manual_review / failed — nothing is discarded). Queued, scanning and
// analyzed records are still proposals and live in the Hub / Review.
export const LOG_STATUSES: readonly Status[] = ["completed", "needs_manual_review", "failed"];

export function isLogRecord(inspection: Inspection): boolean {
  return LOG_STATUSES.includes(inspection.status);
}

export type ResultBucket = "pass" | "fail" | "review";

export const RESULT_LABEL: Record<ResultBucket, string> = {
  pass: "Pass",
  fail: "Fail",
  review: "Needs Review",
};

export const RESULT_ORDER: ResultBucket[] = ["pass", "fail", "review"];

// A saved record has a final Pass/Fail; anything unresolved is "Needs Review".
export function logResult(inspection: Inspection): ResultBucket {
  return inspection.status === "completed" ? finalResult(inspection) : "review";
}

// The category that stands after review — the reviewer's if they set one.
export function effCategory(inspection: Inspection): string | null {
  return inspection.reviewer_category ?? inspection.category;
}

// Findings that survive review (dismissed false positives don't count).
export function finalFindings(inspection: Inspection): Defect[] {
  return inspection.defects.filter((d) => d.review !== "dismissed");
}

// The timestamp the log is ordered by: when it was saved, else when it arrived.
export function recordTime(inspection: Inspection): number {
  return inspection.reviewed_at ?? inspection.created_at;
}

export const ERROR_SHORT: Record<ErrorCode, string> = {
  invalid_json: "Invalid JSON",
  corrupt_image: "Corrupt image",
  timeout: "Timed out",
};

// A one-line "why" under the result badge — how the record got its result.
// Unresolved records name their reason, so nothing looks silently dropped.
export function resultNote(inspection: Inspection): string | null {
  if (inspection.status !== "completed") {
    const lead = inspection.status === "failed" ? "Scan failed" : "Manual review";
    return inspection.error_code ? `${lead} · ${ERROR_SHORT[inspection.error_code]}` : lead;
  }
  return inspection.result_mode !== "auto" ? "Overridden by reviewer" : null;
}

// Real inference runs anywhere from a few seconds to a minute-plus depending on
// the machine, so there's no fixed duration to add anymore — and the data
// model still has no column for when analysis actually finished. This is a
// rough placeholder purely for the Timeline's ordering/pacing; the UI marks
// it "estimated" rather than presenting it as fact.
const TYPICAL_ANALYSIS_MS = 45_000;

export function estimatedAnalyzedAt(inspection: Inspection): number {
  return inspection.created_at + TYPICAL_ANALYSIS_MS;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export const NO_CATEGORY = "__none__"; // filter value for records with no category

export type LogFilters = {
  query: string;
  categories: string[];
  results: ResultBucket[];
  defectTypes: string[];
  from: string; // yyyy-mm-dd, "" = open
  to: string;
};

export const EMPTY_FILTERS: LogFilters = {
  query: "",
  categories: [],
  results: [],
  defectTypes: [],
  from: "",
  to: "",
};

// Filters pre-applied from the URL (e.g. the Analytics "Needs review" tile links
// to /logs?result=review&from=2024-09-12). Unknown or malformed values are
// ignored rather than trusted.
export function filtersFromParams(params: { get(name: string): string | null }): LogFilters {
  const results = (params.get("result") ?? "")
    .split(",")
    .filter((r): r is ResultBucket => r === "pass" || r === "fail" || r === "review");
  const day = (name: string) => {
    const v = params.get(name);
    return v !== null && dayStart(v) !== null ? v : "";
  };
  return { ...EMPTY_FILTERS, results: [...new Set(results)], from: day("from"), to: day("to") };
}

export function hasActiveFilters(f: LogFilters): boolean {
  return (
    f.query.trim() !== "" ||
    f.categories.length > 0 ||
    f.results.length > 0 ||
    f.defectTypes.length > 0 ||
    f.from !== "" ||
    f.to !== ""
  );
}

// yyyy-mm-dd → local midnight. Local, because the reviewer thinks in their day.
export function dayStart(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

// Inclusive: the last millisecond of that local day.
function dayEnd(iso: string): number | null {
  const start = dayStart(iso);
  if (start === null) return null;
  const d = new Date(start);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - 1;
}

// Every filter narrows; they combine with AND. Within one multi-select, a
// record needs to match any chosen value. Category and defect type compare the
// FINAL (reviewed) values; text search also looks at the AI's original category.
export function matchesFilters(inspection: Inspection, f: LogFilters): boolean {
  const terms = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length > 0) {
    const haystack = [inspection.id, inspection.category, inspection.reviewer_category, inspection.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) return false;
  }

  if (f.categories.length > 0 && !f.categories.includes(effCategory(inspection) ?? NO_CATEGORY)) {
    return false;
  }

  if (f.results.length > 0 && !f.results.includes(logResult(inspection))) return false;

  if (f.defectTypes.length > 0) {
    const hit = finalFindings(inspection).some((d) => {
      const type = effType(d);
      return type !== null && f.defectTypes.includes(type);
    });
    if (!hit) return false;
  }

  const time = recordTime(inspection);
  const from = dayStart(f.from);
  const to = dayEnd(f.to);
  if (from !== null && time < from) return false;
  if (to !== null && time > to) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export type SortKey = "id" | "category" | "defects" | "confidence" | "status" | "time";
export type SortDir = "asc" | "desc";
export type SortState = { key: SortKey; dir: SortDir };

export const DEFAULT_SORT: SortState = { key: "time", dir: "desc" };

// The direction a column takes on its first click: newest / biggest first for
// numbers and time, A→Z for text.
export const FIRST_DIR: Record<SortKey, SortDir> = {
  id: "asc",
  category: "asc",
  defects: "desc",
  confidence: "desc",
  status: "asc",
  time: "desc",
};

function idNumber(id: string): number {
  return Number(/(\d+)$/.exec(id)?.[1] ?? 0);
}

function sortValue(i: Inspection, key: SortKey): string | number | null {
  switch (key) {
    case "id":
      return idNumber(i.id);
    case "category":
      return effCategory(i);
    case "defects":
      return finalFindings(i).length;
    case "confidence":
      return i.category_confidence;
    case "status":
      return RESULT_LABEL[logResult(i)];
    case "time":
      return recordTime(i);
  }
}

export function sortRecords(list: Inspection[], sort: SortState): Inspection[] {
  const dir = sort.dir === "asc" ? 1 : -1;

  // Ties fall back to newest-first so the order never jitters between renders.
  const tiebreak = (a: Inspection, b: Inspection) =>
    recordTime(b) - recordTime(a) || idNumber(b.id) - idNumber(a.id);

  return [...list].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    if (va === null && vb === null) return tiebreak(a, b);
    if (va === null) return 1; // missing values always sink, whichever way we sort
    if (vb === null) return -1;
    const cmp = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
    return cmp !== 0 ? cmp * dir : tiebreak(a, b);
  });
}

// ---------------------------------------------------------------------------
// Formatting — call these client-side only (server and browser disagree on
// locale and timezone, which would break hydration).
// ---------------------------------------------------------------------------

function withYear(ms: number): boolean {
  return new Date(ms).getFullYear() !== new Date().getFullYear();
}

export function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(withYear(ms) ? { year: "numeric" } : {}),
  });
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatDateTime(ms: number): string {
  return `${formatDay(ms)}, ${formatClock(ms)}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${Math.max(seconds, 1)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  return `${Math.floor(hours / 24)} d`;
}
