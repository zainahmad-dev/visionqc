"use client";

import { useMemo, useState } from "react";
import {
  buildFrame,
  dailySeries,
  findingConfidences,
  fromInspection,
  inCurrent,
  inPrevious,
  isoDay,
  rankDefects,
  statsFor,
  type ARecord,
  type Range,
} from "@/lib/analytics";
import { isLogRecord, logResult, recordTime } from "@/lib/logs";
import { useStore } from "@/lib/store";
import { useIsClient } from "@/lib/use-is-client";
import ConfidenceHistogram from "@/components/analytics/ConfidenceHistogram";
import RangeSelector from "@/components/analytics/RangeSelector";
import StatTiles from "@/components/analytics/StatTiles";
import TopDefects from "@/components/analytics/TopDefects";
import TrendChart from "@/components/analytics/TrendChart";
import VolumeChart from "@/components/analytics/VolumeChart";

const DEFAULT_RANGE: Range = 30;
const TOP_N = 5;

function Heading() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Analytics</h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Reviewed outcomes — pass rate, defects and AI confidence over time.
      </p>
    </div>
  );
}

function Block({ className }: { className: string }) {
  return <div className={`motion-safe:animate-pulse rounded-[var(--radius-card)] bg-[var(--color-border)] ${className}`} />;
}

// Shown on the server and during hydration. Everything real is time- and
// locale-dependent, so it only renders once the browser is in charge.
function Skeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Heading />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Block key={i} className="h-32" />
        ))}
      </div>
      <Block className="h-80" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Block className="h-72" />
        <Block className="h-72" />
      </div>
    </div>
  );
}

function Body() {
  const { state, dispatch } = useStore();
  const [range, setRange] = useState<Range>(DEFAULT_RANGE);
  // Frozen at mount: the page shouldn't reshuffle its windows under the reviewer.
  const [now] = useState(() => Date.now());

  // ---- one record set → every number on the page ---------------------------
  // Every 'completed' inspection here came from a real Finalize — either
  // loaded from Supabase at the last hard refresh, or saved this session.
  const records = useMemo(
    () => state.inspections.map(fromInspection).filter((r): r is ARecord => r !== null),
    [state.inspections]
  );
  const frame = useMemo(() => buildFrame(range, now), [range, now]);

  const view = useMemo(() => {
    const cur = records.filter((r) => inCurrent(r.at, frame));
    const prev = records.filter((r) => inPrevious(r.at, frame));
    const curStats = statsFor(cur);
    return {
      curStats,
      prevStats: statsFor(prev),
      days: dailySeries(records, frame),
      ranked: rankDefects(curStats.defectCounts, curStats.findingsTotal).slice(0, TOP_N),
      confidences: findingConfidences(cur),
    };
  }, [records, frame]);

  // "Needs review now" counts the same records Logs lists under its Needs Review
  // filter (unresolved ones), so the tile's link lands on exactly that many rows.
  const needsReview = useMemo(() => {
    const unresolved = state.inspections.filter((i) => isLogRecord(i) && logResult(i) === "review");
    return {
      cur: unresolved.filter((i) => inCurrent(recordTime(i), frame)).length,
      prev: unresolved.filter((i) => inPrevious(recordTime(i), frame)).length,
      href: `/logs?result=review&from=${isoDay(frame.start)}`,
    };
  }, [state.inspections, frame]);

  function applyThreshold(value: number) {
    dispatch({ type: "SET_THRESHOLD", value });
    dispatch({
      type: "TOAST",
      message: `Threshold set to ${value}% — findings below it are now flagged across every record.`,
      tone: "success",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading />
        <RangeSelector range={range} onChange={setRange} />
      </div>

      <StatTiles
        cur={view.curStats}
        prev={view.prevStats}
        range={range}
        threshold={state.threshold}
        needsReview={needsReview}
      />

      <TrendChart days={view.days} animateKey={range} />

      <div className="grid gap-6 lg:grid-cols-2">
        <VolumeChart days={view.days} animateKey={range} />
        <TopDefects ranked={view.ranked} findingsTotal={view.curStats.findingsTotal} animateKey={range} />
      </div>

      <ConfidenceHistogram
        confidences={view.confidences}
        threshold={state.threshold}
        onApply={applyThreshold}
      />

      <p className="text-xs text-[var(--color-text-muted)]">
        Every number here comes from a finalized record — earlier ones loaded from the database, this
        session&apos;s as they&apos;re saved.
      </p>
    </div>
  );
}

export default function AnalyticsPage() {
  const isClient = useIsClient();
  return isClient ? <Body /> : <Skeleton />;
}
