"use client";

import { useId, useMemo, useRef, useState } from "react";
import { BadgeCheck, TriangleAlert } from "lucide-react";
import { HIST_MAX, HIST_MIN, binIndex, flaggedAt, histogram } from "@/lib/analytics";
import { clamp, countAxis, fmtInt, fmtPct1, roundedTopBar } from "@/lib/chart";
import ChartCard, { LegendItem } from "./ChartCard";
import DataTable from "./DataTable";
import { useChartWidth } from "./useChartWidth";

const HEIGHT = 260;
const PAD = { l: 40, r: 16, t: 36, b: 30 };
const T_MIN = 50; // same range as the top-bar threshold control
const T_MAX = 95;
const REVIEW = "var(--color-review)";
const CYAN = "var(--color-accent-cyan)";

function Plot({
  confidences,
  value,
  applied,
  onDrag,
}: {
  confidences: number[];
  value: number;
  applied: number;
  onDrag: (v: number) => void;
}) {
  const [wrapRef, width] = useChartWidth();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const [focused, setFocused] = useState(false);
  const uid = useId();
  const sliderId = `${uid}-slider`;

  const bins = useMemo(() => histogram(confidences), [confidences]);
  const axis = useMemo(() => countAxis(Math.max(1, ...bins.map((b) => b.count))), [bins]);
  const { flagged, total } = flaggedAt(confidences, value);
  const pctFlagged = total > 0 ? (flagged / total) * 100 : 0;

  const plotW = Math.max(0, width - PAD.l - PAD.r);
  const plotH = HEIGHT - PAD.t - PAD.b;
  const baseline = PAD.t + plotH;
  const x = (p: number) => PAD.l + ((p - HIST_MIN) / (HIST_MAX - HIST_MIN)) * plotW;
  const yCount = (c: number) => baseline - (c / axis.max) * plotH;
  const lineX = x(value);

  // Pointer → whole-percent threshold, clamped to what the store allows.
  function valueFromPointer(clientX: number): number {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return value;
    const p = HIST_MIN + ((clientX - rect.left - PAD.l) / plotW) * (HIST_MAX - HIST_MIN);
    return clamp(Math.round(p), T_MIN, T_MAX);
  }

  const summary =
    total === 0
      ? "No findings in this period."
      : `At ${value}%, ${fmtPct1(pctFlagged)} of findings (${fmtInt(flagged)}/${fmtInt(total)}) would be flagged`;

  return (
    <div ref={wrapRef} className="relative" style={{ minHeight: HEIGHT }} role="group" aria-label="Confidence distribution with adjustable threshold">
      {/* The real control: a native slider, visually hidden. Arrow keys, Home/End
          and screen-reader semantics are the browser's; the SVG handle mirrors it. */}
      <label htmlFor={sliderId} className="sr-only">
        Confidence threshold, {T_MIN} to {T_MAX} percent
      </label>
      <input
        id={sliderId}
        type="range"
        min={T_MIN}
        max={T_MAX}
        step={1}
        value={value}
        aria-valuetext={`${value}% — ${summary}`}
        onChange={(e) => onDrag(Number(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="sr-only"
      />

      {width > 0 && (
        <svg ref={svgRef} width={width} height={HEIGHT} aria-hidden="true" style={{ display: "block", touchAction: "none" }}>
          <defs>
            <clipPath id={`${uid}-below`}>
              <rect x={PAD.l} y={0} width={Math.max(0, lineX - PAD.l)} height={HEIGHT} />
            </clipPath>
            <clipPath id={`${uid}-above`}>
              <rect x={lineX} y={0} width={Math.max(0, PAD.l + plotW - lineX)} height={HEIGHT} />
            </clipPath>
          </defs>

          {axis.ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.l} x2={PAD.l + plotW} y1={yCount(tick)} y2={yCount(tick)} stroke="var(--color-border)" strokeWidth={1} />
              <text x={PAD.l - 8} y={yCount(tick) + 4} textAnchor="end" fontSize={10} fontFamily="var(--font-mono)" fill="var(--color-text-muted)">
                {tick}
              </text>
            </g>
          ))}
          {[50, 60, 70, 80, 90, 100].map((p) => (
            <text key={p} x={x(p)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fill="var(--color-text-muted)">
              {p}%
            </text>
          ))}

          {/* Each bar is drawn twice and clipped at the line: amber to its left,
              cyan to its right — so a bar the line cuts through is split exactly. */}
          {(
            [
              ["below", REVIEW],
              ["above", CYAN],
            ] as const
          ).map(([which, color]) => (
            <g key={which} clipPath={`url(#${uid}-${which})`} data-bars={which}>
              {bins.map((b) => {
                const h = (b.count / axis.max) * plotH;
                return b.count > 0 ? (
                  <path key={b.lo} d={roundedTopBar(x(b.lo) + 2, baseline - h, x(b.hi) - x(b.lo) - 4, h, 4)} fill={color} />
                ) : null;
              })}
            </g>
          ))}

          {/* Where the threshold is actually applied right now, if the draft has moved */}
          {applied !== value && (
            <g pointerEvents="none">
              <line x1={x(applied)} x2={x(applied)} y1={PAD.t} y2={baseline} stroke="var(--color-text-muted)" strokeWidth={1} strokeDasharray="4 3" />
              <text x={x(applied)} y={PAD.t - 6} textAnchor="middle" fontSize={10} fill="var(--color-text-muted)">
                applied {applied}%
              </text>
            </g>
          )}

          {/* The draggable line + handle */}
          <g pointerEvents="none" data-threshold-line={value}>
            <line x1={lineX} x2={lineX} y1={PAD.t - 4} y2={baseline} stroke="var(--color-text-primary)" strokeWidth={2} />
            <rect
              x={lineX - 22}
              y={2}
              width={44}
              height={22}
              rx={6}
              fill="var(--color-surface-raised)"
              stroke={focused ? CYAN : "var(--color-text-primary)"}
              strokeWidth={focused ? 2.5 : 1.5}
            />
            <text x={lineX} y={17} textAnchor="middle" fontSize={12} fontWeight={600} fontFamily="var(--font-mono)" fill="var(--color-text-primary)">
              {value}%
            </text>
          </g>

          {/* Drag anywhere in the chart: press to place the line, drag to move it */}
          <rect
            x={PAD.l - 10}
            y={0}
            width={plotW + 20}
            height={baseline + 4}
            fill="transparent"
            style={{ cursor: "ew-resize", touchAction: "none" }}
            data-drag-surface=""
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragging.current = true;
              onDrag(valueFromPointer(e.clientX));
            }}
            onPointerMove={(e) => {
              if (dragging.current) onDrag(valueFromPointer(e.clientX));
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
          />
        </svg>
      )}
    </div>
  );
}

export default function ConfidenceHistogram({
  confidences,
  threshold,
  onApply,
}: {
  confidences: number[]; // percent, one per AI-proposed finding in the range
  threshold: number; // the applied (store) threshold
  onApply: (value: number) => void;
}) {
  // A draft only exists while the reviewer is exploring; `null` = show the applied value.
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? threshold;
  const changed = value !== threshold;
  const { flagged, total } = flaggedAt(confidences, value);
  const bins = useMemo(() => histogram(confidences), [confidences]);

  // Flagged-per-bin for the table — from the raw values, with the chart's own binning.
  const flaggedPerBin = useMemo(() => {
    const counts = bins.map(() => 0);
    for (const p of confidences) if (p < value) counts[binIndex(p)] += 1;
    return counts;
  }, [confidences, bins, value]);

  return (
    <ChartCard
      title="Confidence distribution"
      description="AI confidence of every proposed finding. Drag the line to preview a new review threshold."
      legend={
        <>
          <LegendItem color={REVIEW} icon={<TriangleAlert size={14} />} label="Below threshold — flagged for review" />
          <LegendItem color={CYAN} icon={<BadgeCheck size={14} />} label="At or above threshold" />
        </>
      }
      table={
        <DataTable
          caption={`Findings by confidence, with those below ${value}% flagged`}
          columns={[{ label: "Confidence" }, { label: "Findings", align: "right" }, { label: `Flagged at ${value}%`, align: "right" }]}
          rows={bins.map((b, i) => [`${b.lo}–${b.hi}%`, b.count, flaggedPerBin[i]])}
        />
      }
    >
      <Plot confidences={confidences} value={value} applied={threshold} onDrag={setDraft} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
        <p role="status" aria-live="polite" className="text-sm text-[var(--color-text-secondary)]" data-preview="">
          {total === 0 ? (
            "No findings in this period."
          ) : (
            <>
              At <span className="font-mono font-semibold text-[var(--color-text-primary)]">{value}%</span>,{" "}
              <span className="font-mono font-semibold text-[var(--color-review)]">{fmtPct1((flagged / total) * 100)}</span> of findings (
              <span className="font-mono">
                {fmtInt(flagged)}/{fmtInt(total)}
              </span>
              ) would be flagged
            </>
          )}
        </p>
        <div className="flex items-center gap-2">
          {changed && (
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="flex h-11 items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
            >
              Reset
            </button>
          )}
          <button
            type="button"
            aria-disabled={!changed}
            onClick={() => {
              if (!changed) return;
              onApply(value);
              setDraft(null);
            }}
            className="flex h-11 items-center rounded-[var(--radius-control)] border px-5 text-sm font-medium transition-opacity"
            style={{
              // Disabled = quiet surface + secondary text (readable in both themes),
              // not white-on-grey. Enabled = the accent gradient.
              background: changed ? "var(--gradient-accent-strong)" : "var(--color-surface-raised)",
              borderColor: changed ? "transparent" : "var(--color-border-strong)",
              color: changed ? "#fff" : "var(--color-text-secondary)",
              cursor: changed ? "pointer" : "not-allowed",
            }}
          >
            {changed ? `Apply ${value}%` : "Applied"}
          </button>
        </div>
      </div>
    </ChartCard>
  );
}
