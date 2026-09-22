// Pure aggregation for the Analytics page. No React, no Date.now() — callers
// pass `now`, so every function here is deterministic and testable.
//
// Everything is computed from one normalised shape (ARecord) that both the live
// store and the sample history are converted into, so a chart, its tooltip, its
// table and the tiles can never read different numbers.

import { effType, finalResult } from "./rules";
import type { Inspection } from "./types";

// ---------------------------------------------------------------------------
// Normalised records
// ---------------------------------------------------------------------------

export type AFinding = {
  type: string | null;
  confidence: number | null; // AI confidence 0..1; null for reviewer-added findings
  dismissed: boolean;
};

export type ARecord = {
  id: string;
  at: number; // when the outcome was saved
  result: "pass" | "fail";
  confidence: number | null; // overall AI confidence 0..1
  findings: AFinding[];
};

// Only saved (completed) inspections are "reviewed outcomes".
export function fromInspection(i: Inspection): ARecord | null {
  if (i.status !== "completed") return null;
  return {
    id: i.id,
    at: i.reviewed_at ?? i.created_at,
    result: finalResult(i),
    confidence: i.category_confidence,
    findings: i.defects.map((d) => ({
      type: effType(d),
      confidence: d.ai_confidence,
      dismissed: d.review === "dismissed",
    })),
  };
}

const keptFindings = (r: ARecord) => r.findings.filter((f) => !f.dismissed);

// ---------------------------------------------------------------------------
// Time windows — local calendar days, so "last 7 days" means 7 calendar days
// ending today, and a record at 23:50 belongs to the day the reviewer saw.
// ---------------------------------------------------------------------------

export type Range = 7 | 30 | 90;
export const RANGES: readonly Range[] = [7, 30, 90];

function localMidnight(ms: number, addDays = 0): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays).getTime();
}

export type Frame = {
  range: Range;
  dayStarts: number[]; // local midnight of each day in the current window, oldest first
  start: number; // current window: [start, end)
  end: number;
  prevStart: number; // previous window (same length, directly before): [prevStart, start)
};

export function buildFrame(range: Range, now: number): Frame {
  const dayStarts = Array.from({ length: range }, (_, i) => localMidnight(now, i - (range - 1)));
  return {
    range,
    dayStarts,
    start: dayStarts[0],
    end: localMidnight(now, 1),
    prevStart: localMidnight(now, -(2 * range - 1)),
  };
}

export const inCurrent = (t: number, f: Frame) => t >= f.start && t < f.end;
export const inPrevious = (t: number, f: Frame) => t >= f.prevStart && t < f.start;

// yyyy-mm-dd of a local day — the format the Logs date filter speaks.
export function isoDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Tile stats
// ---------------------------------------------------------------------------

export type TopDefect = { type: string; count: number; share: number }; // share: 0..100

export type PeriodStats = {
  total: number;
  passCount: number;
  passRate: number | null; // percent
  avgConfidence: number | null; // percent
  defectCounts: Map<string, number>;
  findingsTotal: number;
  topDefect: TopDefect | null;
};

export function statsFor(records: ARecord[]): PeriodStats {
  let passCount = 0;
  let confSum = 0;
  let confN = 0;
  const defectCounts = new Map<string, number>();
  let findingsTotal = 0;

  for (const r of records) {
    if (r.result === "pass") passCount += 1;
    if (r.confidence !== null) {
      confSum += r.confidence;
      confN += 1;
    }
    for (const f of keptFindings(r)) {
      if (f.type === null) continue;
      defectCounts.set(f.type, (defectCounts.get(f.type) ?? 0) + 1);
      findingsTotal += 1;
    }
  }

  const ranked = rankDefects(defectCounts, findingsTotal);
  return {
    total: records.length,
    passCount,
    passRate: records.length > 0 ? (passCount / records.length) * 100 : null,
    avgConfidence: confN > 0 ? (confSum / confN) * 100 : null,
    defectCounts,
    findingsTotal,
    topDefect: ranked[0] ?? null,
  };
}

// Count descending; ties broken by name so the order never flickers.
export function rankDefects(counts: Map<string, number>, total: number): TopDefect[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([type, count]) => ({ type, count, share: total > 0 ? (count / total) * 100 : 0 }));
}

// ---------------------------------------------------------------------------
// Deltas vs the previous period
// ---------------------------------------------------------------------------

export type Direction = "up" | "down" | "flat";

// Percentage change; null when there's no previous value to compare against.
export function relativeChange(cur: number, prev: number): number | null {
  return prev === 0 ? null : ((cur - prev) / prev) * 100;
}

export function directionOf(delta: number, epsilon = 0.05): Direction {
  return delta > epsilon ? "up" : delta < -epsilon ? "down" : "flat";
}

// Signed text with a true minus sign: "+8.2%", "−1.4 pts", "+3".
export function formatDelta(delta: number, digits: number, unit: string): string {
  const abs = Math.abs(delta).toFixed(digits);
  const sign = directionOf(delta, 0.5 * 10 ** -digits) === "flat" ? "" : delta > 0 ? "+" : "−";
  return `${sign}${abs}${unit}`;
}

// ---------------------------------------------------------------------------
// Series
// ---------------------------------------------------------------------------

export type Bucket = {
  start: number; // first day (local midnight)
  end: number; // last day (local midnight) — equals start for a single day
  pass: number;
  fail: number;
  total: number;
  passRate: number | null; // percent
};

const makeBucket = (start: number, end: number, pass: number, fail: number): Bucket => ({
  start,
  end,
  pass,
  fail,
  total: pass + fail,
  passRate: pass + fail > 0 ? (pass / (pass + fail)) * 100 : null,
});

// One bucket per calendar day of the current window (zero-filled).
export function dailySeries(records: ARecord[], frame: Frame): Bucket[] {
  const pass = new Array<number>(frame.range).fill(0);
  const fail = new Array<number>(frame.range).fill(0);

  for (const r of records) {
    if (!inCurrent(r.at, frame)) continue;
    // Last day whose midnight is <= the record's time (binary search — days are sorted).
    let lo = 0;
    let hi = frame.dayStarts.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (frame.dayStarts[mid] <= r.at) lo = mid;
      else hi = mid - 1;
    }
    if (r.result === "pass") pass[lo] += 1;
    else fail[lo] += 1;
  }

  return frame.dayStarts.map((d, i) => makeBucket(d, d, pass[i], fail[i]));
}

// Seven-day chunks counted back from today, so the newest bucket is always a
// full week; the oldest may be short. Sums always equal the daily series.
export function weeklySeries(daily: Bucket[]): Bucket[] {
  const out: Bucket[] = [];
  for (let end = daily.length; end > 0; end -= 7) {
    const chunk = daily.slice(Math.max(0, end - 7), end);
    out.unshift(
      makeBucket(
        chunk[0].start,
        chunk[chunk.length - 1].end,
        chunk.reduce((s, b) => s + b.pass, 0),
        chunk.reduce((s, b) => s + b.fail, 0)
      )
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Confidence histogram
// ---------------------------------------------------------------------------

export const HIST_MIN = 50; // percent
export const HIST_MAX = 100;
export const HIST_BIN = 5;
export const HIST_BINS = (HIST_MAX - HIST_MIN) / HIST_BIN;

// Every AI-proposed finding has a confidence — including ones the reviewer
// later dismissed (the threshold decides what gets flagged BEFORE review).
// Reviewer-added findings have none, so they're not part of the distribution.
export function findingConfidences(records: ARecord[]): number[] {
  const out: number[] = [];
  for (const r of records) {
    for (const f of r.findings) if (f.confidence !== null) out.push(f.confidence * 100);
  }
  return out;
}

export type HistBin = { lo: number; hi: number; count: number };

// The one binning rule: chart, table and flagged-per-bin all use it.
export function binIndex(pct: number): number {
  return Math.min(HIST_BINS - 1, Math.max(0, Math.floor((pct - HIST_MIN) / HIST_BIN)));
}

// 5-point bins over 50–100. Anything under 50 lands in the first bin (the
// threshold control can't go below 50 either); 100 lands in the last.
export function histogram(confidences: number[]): HistBin[] {
  const bins: HistBin[] = Array.from({ length: HIST_BINS }, (_, i) => ({
    lo: HIST_MIN + i * HIST_BIN,
    hi: HIST_MIN + (i + 1) * HIST_BIN,
    count: 0,
  }));
  for (const pct of confidences) bins[binIndex(pct)].count += 1;
  return bins;
}

// How many findings sit strictly below the threshold (the rule the store uses:
// confidence * 100 < threshold).
export function flaggedAt(confidences: number[], threshold: number): { flagged: number; total: number } {
  let flagged = 0;
  for (const pct of confidences) if (pct < threshold) flagged += 1;
  return { flagged, total: confidences.length };
}
