"use client";

import { useId, useState, type ReactNode } from "react";
import { ChartColumn, Table2 } from "lucide-react";

type View = "chart" | "table";

// Every chart lives in one of these: a title, an optional legend and controls,
// and a Chart / Table toggle. The table shows the numbers the chart draws.
//
// `children` is the chart; `table` is the same data as rows. Only one is
// mounted at a time, so each chart's own hooks (width, cursor) live in a child
// component and restart cleanly when the reviewer flips back to the chart.
export default function ChartCard({
  title,
  description,
  legend,
  controls,
  table,
  children,
}: {
  title: string;
  description?: string;
  legend?: ReactNode;
  controls?: ReactNode;
  table: ReactNode;
  children: ReactNode;
}) {
  const [view, setView] = useState<View>("chart");
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold text-[var(--color-text-primary)]">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {controls}
          <div
            role="group"
            aria-label={`${title}: view`}
            className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] p-1"
          >
            {(
              [
                ["chart", "Chart", ChartColumn],
                ["table", "Table", Table2],
              ] as const
            ).map(([value, label, Icon]) => {
              const on = view === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setView(value)}
                  className="flex h-11 items-center gap-1.5 rounded-[6px] px-2.5 text-xs font-medium transition-colors"
                  style={{
                    color: on ? "var(--color-accent-cyan)" : "var(--color-text-secondary)",
                    background: on ? "color-mix(in srgb, var(--color-accent-cyan) 14%, transparent)" : "transparent",
                  }}
                >
                  <Icon size={14} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {legend && view === "chart" && <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{legend}</div>}

      {view === "chart" ? children : table}
    </section>
  );
}

// One legend entry: a marker + text, so a series is never identified by colour alone.
export function LegendItem({ color, icon, label }: { color: string; icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]" style={{ ["--legend" as string]: color }}>
      <span className="flex h-4 w-4 items-center justify-center" style={{ color }} aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}
