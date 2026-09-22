"use client";

import { RANGES, type Range } from "@/lib/analytics";

// Native radios, styled as a segmented control — arrow keys, focus and screen
// reader semantics come for free.
export default function RangeSelector({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <fieldset className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      <legend className="sr-only">Date range</legend>
      {RANGES.map((r) => (
        <label key={r} className="relative cursor-pointer">
          <input
            type="radio"
            name="analytics-range"
            value={r}
            checked={range === r}
            onChange={() => onChange(r)}
            className="peer sr-only"
          />
          <span className="flex h-11 min-w-14 items-center justify-center rounded-[6px] px-3 font-mono text-sm text-[var(--color-text-secondary)] transition-colors peer-checked:bg-[var(--color-accent-cyan)]/15 peer-checked:text-[var(--color-accent-cyan)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-accent-cyan)]">
            {r}d<span className="sr-only"> — last {r} days</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
