"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import {
  directionOf,
  formatDelta,
  relativeChange,
  type Direction,
  type PeriodStats,
  type Range,
} from "@/lib/analytics";
import { fmtInt } from "@/lib/chart";
import { DEFECT_LABEL } from "@/lib/types";
import CountUp from "./CountUp";

// good = green, bad = red, neutral = muted. Direction is always ALSO an arrow
// and a signed number — colour is never the only signal.
type Tone = "good" | "bad" | "neutral";
type DeltaInfo = { text: string; direction: Direction; tone: Tone } | null;

const TONE_COLOR: Record<Tone, string> = {
  good: "var(--color-pass)",
  bad: "var(--color-fail)",
  neutral: "var(--color-text-secondary)",
};
const DIRECTION_ICON: Record<Direction, LucideIcon> = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };
const TONE_WORD: Record<Tone, string> = { good: "improvement", bad: "worse", neutral: "" };

// `higherIs` says which way is better: "good" (pass rate ↑), "bad" (defects ↑),
// or "neutral" (raw volume — more isn't better or worse).
function toDelta(diff: number | null, digits: number, unit: string, higherIs: Tone): DeltaInfo {
  if (diff === null) return null;
  const direction = directionOf(diff, 0.5 * 10 ** -digits);
  const tone: Tone = direction === "flat" || higherIs === "neutral" ? "neutral" : (direction === "up") === (higherIs === "good") ? "good" : "bad";
  return { text: formatDelta(diff, digits, unit), direction, tone };
}

function Delta({ delta, range }: { delta: DeltaInfo; range: Range }) {
  if (!delta) {
    return <p className="text-xs text-[var(--color-text-muted)]">No previous {range}d to compare</p>;
  }
  const Icon = DIRECTION_ICON[delta.direction];
  return (
    <p className="flex items-center gap-1 text-xs" style={{ color: TONE_COLOR[delta.tone] }}>
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      <span className="font-mono font-medium">{delta.text}</span>
      <span className="text-[var(--color-text-muted)]">vs prev {range}d</span>
      <span className="sr-only">
        {delta.direction === "flat" ? " (no change)" : delta.tone === "neutral" ? "" : ` (${TONE_WORD[delta.tone]})`}
      </span>
    </p>
  );
}

type Tile = {
  key: string;
  label: string;
  value: ReactNode;
  sub: string;
  delta: DeltaInfo;
  href?: string;
};

export type NeedsReview = { cur: number; prev: number; href: string };

export default function StatTiles({
  cur,
  prev,
  range,
  threshold,
  needsReview,
}: {
  cur: PeriodStats;
  prev: PeriodStats;
  range: Range;
  threshold: number;
  needsReview: NeedsReview;
}) {
  const top = cur.topDefect;
  const topPrevCount = top ? (prev.defectCounts.get(top.type) ?? 0) : 0;

  const tiles: Tile[] = [
    {
      key: "total",
      label: "Total inspected",
      value: <CountUp value={cur.total} />,
      sub: `${fmtInt(cur.passCount)} pass · ${fmtInt(cur.total - cur.passCount)} fail`,
      delta: toDelta(relativeChange(cur.total, prev.total), 1, "%", "neutral"),
    },
    {
      key: "pass-rate",
      label: "Pass rate",
      value: cur.passRate === null ? "—" : <CountUp value={cur.passRate} decimals={1} suffix="%" />,
      sub: `${fmtInt(cur.passCount)} of ${fmtInt(cur.total)} passed`,
      delta: cur.passRate !== null && prev.passRate !== null ? toDelta(cur.passRate - prev.passRate, 1, " pts", "good") : null,
    },
    {
      key: "top-defect",
      label: "Most common defect",
      value: top ? (DEFECT_LABEL[top.type] ?? top.type) : "—",
      sub: top ? `${fmtInt(top.count)} findings · ${top.share.toFixed(1)}% of all` : "No findings in this period",
      delta: top ? toDelta(relativeChange(top.count, topPrevCount), 1, "%", "bad") : null,
    },
    {
      key: "confidence",
      label: "Average AI confidence",
      value: cur.avgConfidence === null ? "—" : <CountUp value={cur.avgConfidence} decimals={1} suffix="%" />,
      sub: `Review threshold ${threshold}%`,
      delta:
        cur.avgConfidence !== null && prev.avgConfidence !== null
          ? toDelta(cur.avgConfidence - prev.avgConfidence, 1, " pts", "good")
          : null,
    },
    {
      key: "needs-review",
      label: "Needs review now",
      value: <CountUp value={needsReview.cur} />,
      sub: `unresolved from the last ${range} days`,
      delta: toDelta(needsReview.cur - needsReview.prev, 0, "", "bad"),
      href: needsReview.href,
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {tiles.map((tile, i) => {
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">{tile.label}</span>
              {tile.href && <ArrowRight size={14} className="shrink-0 text-[var(--color-accent-cyan)]" aria-hidden="true" />}
            </div>
            <p className="mt-2 truncate font-mono text-2xl font-semibold text-[var(--color-text-primary)] sm:text-[28px]">
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{tile.sub}</p>
            <div className="mt-2">
              <Delta delta={tile.delta} range={range} />
            </div>
            {tile.href && <span className="sr-only">Opens the matching records in Logs</span>}
          </>
        );
        const cls =
          "block h-full rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4";
        return (
          // The last of five tiles spans both columns of the two-up phone layout.
          <li key={tile.key} className={i === tiles.length - 1 ? "col-span-2 lg:col-span-1" : ""} data-tile={tile.key}>
            {tile.href ? (
              <Link href={tile.href} className={`${cls} transition-colors hover:border-[var(--color-accent-cyan)]`}>
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
