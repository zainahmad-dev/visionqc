"use client";

import { useId, useMemo, useState } from "react";
import { useReducedMotion, motion } from "framer-motion";
import type { Bucket } from "@/lib/analytics";
import { weeklySeries } from "@/lib/analytics";
import { clamp, countAxis, fmtDay, fmtInt, fmtSpan, labelIndices, roundedTopBar } from "@/lib/chart";
import ChartCard from "./ChartCard";
import DataTable from "./DataTable";
import { useChartCursor } from "./useChartCursor";
import { useChartWidth } from "./useChartWidth";

type Grain = "day" | "week";

const HEIGHT = 240;
const PAD = { l: 40, r: 12, t: 22, b: 30 };
const MAX_BAR = 24; // px
const RADIUS = 4;

const describe = (b: Bucket) => `${fmtSpan(b.start, b.end)}: ${b.total} inspections, ${b.pass} pass, ${b.fail} fail`;

function Plot({ buckets, grain, animateKey }: { buckets: Bucket[]; grain: Grain; animateKey: string }) {
  const [wrapRef, width] = useChartWidth();
  const reduceMotion = useReducedMotion();
  const gradientId = useId();
  const n = buckets.length;
  const cursor = useChartCursor(n, (i) => describe(buckets[i]));

  const axis = useMemo(() => countAxis(Math.max(1, ...buckets.map((b) => b.total))), [buckets]);
  const plotW = Math.max(0, width - PAD.l - PAD.r);
  const plotH = HEIGHT - PAD.t - PAD.b;
  const baseline = PAD.t + plotH;
  const band = n > 0 ? plotW / n : 0;
  const barW = Math.min(MAX_BAR, band * 0.72);
  const barX = (i: number) => PAD.l + band * i + (band - barW) / 2;
  const barH = (v: number) => (v / axis.max) * plotH;

  const xLabels = labelIndices(n, Math.max(2, Math.floor(plotW / 72)));
  const tallest = buckets.reduce((best, b, i) => (b.total > buckets[best].total ? i : best), 0);
  const active = cursor.active;

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    cursor.hover(clamp(Math.floor((e.clientX - rect.left - PAD.l) / band), 0, n - 1));
  }

  return (
    <div
      ref={wrapRef}
      className="relative"
      style={{ minHeight: HEIGHT }}
      role="group"
      aria-roledescription="bar chart"
      aria-label={`Inspections per ${grain} over ${n} ${grain}s. Focus, then use the left and right arrow keys to step through them.`}
      {...cursor.containerProps}
    >
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          aria-hidden="true"
          style={{ touchAction: "pan-y", display: "block" }}
          onPointerMove={onPointerMove}
          onPointerLeave={cursor.leave}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent-cyan)" />
              <stop offset="100%" stopColor="var(--color-accent-indigo)" />
            </linearGradient>
          </defs>

          {axis.ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.l} x2={PAD.l + plotW} y1={baseline - barH(tick)} y2={baseline - barH(tick)} stroke="var(--color-border)" strokeWidth={1} />
              <text x={PAD.l - 8} y={baseline - barH(tick) + 4} textAnchor="end" fontSize={10} fontFamily="var(--font-mono)" fill="var(--color-text-muted)">
                {tick}
              </text>
            </g>
          ))}

          {buckets.map((b, i) =>
            xLabels.has(i) ? (
              <text key={b.start} x={PAD.l + band * i + band / 2} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fill="var(--color-text-muted)">
                {grain === "day" ? fmtDay(b.start) : fmtDay(b.end)}
              </text>
            ) : null
          )}

          {buckets.map((b, i) => {
            const h = Math.max(b.total > 0 ? 2 : 0, barH(b.total));
            return (
              <motion.g
                key={`${animateKey}-${b.start}`}
                initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : Math.min(i * 0.008, 0.4), ease: "easeOut" }}
              >
                <path
                  d={b.total > 0 ? roundedTopBar(barX(i), baseline - h, barW, h, RADIUS) : ""}
                  fill={`url(#${gradientId})`}
                  opacity={active === null || active === i ? 1 : 0.55}
                  data-bar={b.total}
                />
              </motion.g>
            );
          })}

          {/* Label only the tallest bar — a number on every bar is noise */}
          {buckets[tallest]?.total > 0 && (
            <text x={PAD.l + band * tallest + band / 2} y={baseline - barH(buckets[tallest].total) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fontFamily="var(--font-mono)" fill="var(--color-text-primary)">
              {buckets[tallest].total}
            </text>
          )}

          {active !== null && (
            <rect
              x={PAD.l + band * active}
              y={PAD.t}
              width={band}
              height={plotH}
              fill="var(--color-text-primary)"
              opacity={0.06}
              pointerEvents="none"
              data-crosshair={active}
            />
          )}
        </svg>
      )}

      {active !== null && width > 0 && (
        <div
          role="presentation"
          data-tooltip=""
          className="pointer-events-none absolute z-10 w-48 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-2.5 text-xs shadow-lg"
          style={{
            left: PAD.l + band * active + band / 2,
            top: PAD.t,
            transform: PAD.l + band * active > width * 0.6 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
          }}
        >
          <p className="mb-1 font-medium text-[var(--color-text-primary)]">{fmtSpan(buckets[active].start, buckets[active].end)}</p>
          <p className="flex items-center justify-between gap-2 text-[var(--color-text-secondary)]">
            Inspections <span className="font-mono font-semibold text-[var(--color-text-primary)]">{fmtInt(buckets[active].total)}</span>
          </p>
          <p className="text-[var(--color-text-muted)]">
            {buckets[active].pass} pass · {buckets[active].fail} fail
          </p>
        </div>
      )}

      <p className="sr-only" aria-live="polite">
        {cursor.announcement}
      </p>
    </div>
  );
}

function GrainToggle({ grain, onChange }: { grain: Grain; onChange: (g: Grain) => void }) {
  return (
    <div role="group" aria-label="Group by" className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] p-1">
      {(["day", "week"] as const).map((g) => (
        <button
          key={g}
          type="button"
          aria-pressed={grain === g}
          onClick={() => onChange(g)}
          className="flex h-11 min-w-11 items-center justify-center rounded-[6px] px-2.5 text-xs font-medium capitalize transition-colors"
          style={{
            color: grain === g ? "var(--color-accent-cyan)" : "var(--color-text-secondary)",
            background: grain === g ? "color-mix(in srgb, var(--color-accent-cyan) 14%, transparent)" : "transparent",
          }}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

export default function VolumeChart({ days, animateKey }: { days: Bucket[]; animateKey: number }) {
  const [grain, setGrain] = useState<Grain>("day");
  const buckets = useMemo(() => (grain === "day" ? days : weeklySeries(days)), [days, grain]);
  const total = days.reduce((s, d) => s + d.total, 0);

  return (
    <ChartCard
      title="Inspection volume"
      description={`${fmtInt(total)} inspections, by ${grain}`}
      controls={<GrainToggle grain={grain} onChange={setGrain} />}
      table={
        <DataTable
          caption={`Inspections per ${grain}`}
          columns={[
            { label: grain === "day" ? "Day" : "Week" },
            { label: "Inspections", align: "right" },
            { label: "Pass", align: "right" },
            { label: "Fail", align: "right" },
          ]}
          rows={buckets.map((b) => [fmtSpan(b.start, b.end), b.total, b.pass, b.fail])}
        />
      }
    >
      <Plot buckets={buckets} grain={grain} animateKey={`${animateKey}-${grain}`} />
    </ChartCard>
  );
}
