"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";
import type { Bucket } from "@/lib/analytics";
import { clamp, countAxis, fmtDay, fmtDayLong, fmtInt, fmtPctOrDash, labelIndices } from "@/lib/chart";
import ChartCard, { LegendItem } from "./ChartCard";
import DataTable from "./DataTable";
import { useChartCursor } from "./useChartCursor";
import { useChartWidth } from "./useChartWidth";

const HEIGHT = 280;
const PAD = { l: 40, r: 68, t: 16, b: 30 };
const PASS = "var(--color-pass)";
const FAIL = "var(--color-fail)";

// The one place a period is described in words — tooltip, live region and
// table all use these numbers, formatted the same way.
const describe = (d: Bucket) =>
  `${fmtDayLong(d.start)}: ${d.pass} pass, ${d.fail} fail, pass rate ${fmtPctOrDash(d.passRate)}`;

function linePath(points: [number, number][]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
}

function Plot({ days, animateKey }: { days: Bucket[]; animateKey: number }) {
  const [wrapRef, width] = useChartWidth();
  const reduceMotion = useReducedMotion();
  const n = days.length;
  const cursor = useChartCursor(n, (i) => describe(days[i]));

  const axis = useMemo(() => countAxis(Math.max(1, ...days.map((d) => Math.max(d.pass, d.fail)))), [days]);
  const plotW = Math.max(0, width - PAD.l - PAD.r);
  const plotH = HEIGHT - PAD.t - PAD.b;
  const baseline = PAD.t + plotH;

  const x = (i: number) => PAD.l + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => baseline - (v / axis.max) * plotH;

  const passPts = days.map((d, i): [number, number] => [x(i), y(d.pass)]);
  const failPts = days.map((d, i): [number, number] => [x(i), y(d.fail)]);
  const areaOf = (pts: [number, number][]) =>
    pts.length === 0 ? "" : `${linePath(pts)} L${pts[pts.length - 1][0].toFixed(1)} ${baseline} L${pts[0][0].toFixed(1)} ${baseline} Z`;

  const xLabels = labelIndices(n, Math.max(2, Math.floor(plotW / 72)));
  const active = cursor.active;
  const draw = { duration: reduceMotion ? 0 : 0.9, ease: "easeOut" as const };

  // End-of-line labels name the series where the eye finishes reading it,
  // nudged apart if the two lines end close together.
  const last = days[n - 1];
  let passLabelY = y(last?.pass ?? 0);
  let failLabelY = y(last?.fail ?? 0);
  if (Math.abs(passLabelY - failLabelY) < 14) {
    if (passLabelY <= failLabelY) {
      passLabelY -= 7;
      failLabelY += 7;
    } else {
      passLabelY += 7;
      failLabelY -= 7;
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - PAD.l;
    cursor.hover(n <= 1 ? 0 : clamp(Math.round((px / plotW) * (n - 1)), 0, n - 1));
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{ minHeight: HEIGHT }}
      role="group"
      aria-roledescription="line chart"
      aria-label={`Pass versus fail per day over ${n} days. Focus, then use the left and right arrow keys to step through days.`}
      {...cursor.containerProps}
    >
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          aria-hidden="true"
          style={{ touchAction: "pan-y", display: "block" }}
          onPointerMove={onPointerMove}
          onPointerLeave={cursor.leave}
        >
          {/* Hairline gridlines + recessive y-axis labels */}
          {axis.ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.l} x2={PAD.l + plotW} y1={y(tick)} y2={y(tick)} stroke="var(--color-border)" strokeWidth={1} />
              <text x={PAD.l - 8} y={y(tick) + 4} textAnchor="end" fontSize={10} fontFamily="var(--font-mono)" fill="var(--color-text-muted)">
                {tick}
              </text>
            </g>
          ))}

          {/* X labels — selective, never one per point */}
          {days.map((d, i) =>
            xLabels.has(i) ? (
              <text key={d.start} x={x(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fill="var(--color-text-muted)">
                {fmtDay(d.start)}
              </text>
            ) : null
          )}

          {/* Areas (10%) then lines (2px), drawn in on mount via pathLength */}
          <motion.path key={`fa-${animateKey}`} d={areaOf(failPts)} fill={FAIL} initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} transition={draw} />
          <motion.path key={`pa-${animateKey}`} d={areaOf(passPts)} fill={PASS} initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} transition={draw} />
          <motion.path
            key={`fl-${animateKey}`}
            d={linePath(failPts)}
            fill="none"
            stroke={FAIL}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={draw}
          />
          <motion.path
            key={`pl-${animateKey}`}
            d={linePath(passPts)}
            fill="none"
            stroke={PASS}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={draw}
          />

          {last && (
            <>
              <text x={x(n - 1) + 8} y={passLabelY + 4} fontSize={11} fontWeight={600} fill={PASS}>
                Pass {last.pass}
              </text>
              <text x={x(n - 1) + 8} y={failLabelY + 4} fontSize={11} fontWeight={600} fill={FAIL}>
                Fail {last.fail}
              </text>
            </>
          )}

          {/* Crosshair snapped to the period under the cursor */}
          {active !== null && (
            <g pointerEvents="none" data-crosshair={active}>
              <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={baseline} stroke="var(--color-border-strong)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(days[active].pass)} r={4.5} fill="var(--color-surface)" stroke={PASS} strokeWidth={2} />
              <circle cx={x(active)} cy={y(days[active].fail)} r={4.5} fill="var(--color-surface)" stroke={FAIL} strokeWidth={2} />
            </g>
          )}
        </svg>
      )}

      {active !== null && width > 0 && (
        <div
          role="presentation"
          data-tooltip=""
          className="pointer-events-none absolute z-10 w-44 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-2.5 text-xs shadow-lg"
          style={{
            left: x(active),
            top: PAD.t,
            transform: x(active) > width * 0.6 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="mb-1.5 font-medium text-[var(--color-text-primary)]">{fmtDayLong(days[active].start)}</p>
          <p className="flex items-center justify-between gap-2" style={{ color: PASS }}>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} aria-hidden="true" /> Pass
            </span>
            <span className="font-mono font-semibold">{days[active].pass}</span>
          </p>
          <p className="flex items-center justify-between gap-2" style={{ color: FAIL }}>
            <span className="flex items-center gap-1.5">
              <XCircle size={12} aria-hidden="true" /> Fail
            </span>
            <span className="font-mono font-semibold">{days[active].fail}</span>
          </p>
          <p className="mt-1.5 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-1.5 text-[var(--color-text-secondary)]">
            Pass rate
            <span className="font-mono font-semibold text-[var(--color-text-primary)]">{fmtPctOrDash(days[active].passRate)}</span>
          </p>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {cursor.announcement}
      </p>
    </div>
  );
}

export default function TrendChart({ days, animateKey }: { days: Bucket[]; animateKey: number }) {
  const total = days.reduce((s, d) => s + d.total, 0);

  return (
    <ChartCard
      title="Pass vs Fail trend"
      description={`Inspections per day — ${fmtInt(total)} in the last ${days.length} days`}
      legend={
        <>
          <LegendItem color={PASS} icon={<CheckCircle2 size={14} />} label="Pass" />
          <LegendItem color={FAIL} icon={<XCircle size={14} />} label="Fail" />
        </>
      }
      table={
        <DataTable
          caption="Pass and fail counts per day"
          columns={[
            { label: "Day" },
            { label: "Pass", align: "right" },
            { label: "Fail", align: "right" },
            { label: "Total", align: "right" },
            { label: "Pass rate", align: "right" },
          ]}
          rows={days.map((d) => [fmtDayLong(d.start), d.pass, d.fail, d.total, fmtPctOrDash(d.passRate)])}
        />
      }
    >
      <Plot days={days} animateKey={animateKey} />
    </ChartCard>
  );
}
