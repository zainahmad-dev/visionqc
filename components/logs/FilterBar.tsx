"use client";

import { Search } from "lucide-react";
import { DEFECT_LABEL } from "@/lib/types";
import { RESULT_LABEL, RESULT_ORDER, type LogFilters, type ResultBucket } from "@/lib/logs";
import MultiSelect, { type Option } from "./MultiSelect";
import FilterChips from "./FilterChips";
import { RESULT_META } from "./ResultBadge";

export const SEARCH_INPUT_ID = "logs-search";

const DATE_INPUT =
  "h-11 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-2 font-mono text-sm text-[var(--color-text-primary)]";

// Pass / Fail / Needs Review — three independent toggles. None on = show all.
function ResultToggles({
  selected,
  onChange,
}: {
  selected: ResultBucket[];
  onChange: (next: ResultBucket[]) => void;
}) {
  return (
    <div role="group" aria-label="Result" className="flex flex-wrap items-center gap-2">
      {RESULT_ORDER.map((result) => {
        const { color, icon: Icon } = RESULT_META[result];
        const on = selected.includes(result);
        return (
          <button
            key={result}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((r) => r !== result) : [...selected, result])}
            className="flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] border px-3 text-sm font-medium transition-colors"
            style={{
              borderColor: on ? color : "var(--color-border-strong)",
              color: on ? color : "var(--color-text-secondary)",
              background: on ? `color-mix(in srgb, ${color} 14%, transparent)` : "transparent",
            }}
          >
            <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
            {RESULT_LABEL[result]}
          </button>
        );
      })}
    </div>
  );
}

function DateRange({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
}) {
  const invalid = from !== "" && to !== "" && from > to;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        From
        <input
          type="date"
          value={from}
          max={to || undefined}
          aria-invalid={invalid}
          onChange={(e) => onFrom(e.target.value)}
          className={DATE_INPUT}
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        To
        <input
          type="date"
          value={to}
          min={from || undefined}
          aria-invalid={invalid}
          onChange={(e) => onTo(e.target.value)}
          className={DATE_INPUT}
        />
      </label>
      {invalid && (
        <span role="alert" className="text-xs text-[var(--color-review)]">
          “From” is after “To” — nothing can match.
        </span>
      )}
    </div>
  );
}

// Sticky from md up — on a phone the bar is tall enough that pinning it would
// eat the screen. Everything is controlled: the page owns the filter state.
export default function FilterBar({
  filters,
  onChange,
  onClearAll,
  categoryOptions,
  defectOptions,
}: {
  filters: LogFilters;
  onChange: (next: LogFilters) => void;
  onClearAll: () => void;
  categoryOptions: Option[];
  defectOptions: Option[];
}) {
  return (
    <section
      aria-label="Filter records"
      className="z-20 flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 backdrop-blur-sm md:sticky md:top-[4.5rem]"
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1">
          <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
            Search by ID, category or notes
          </label>
          <Search
            size={15}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            id={SEARCH_INPUT_ID}
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Search ID, category, notes…"
            autoComplete="off"
            className="h-11 w-full rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] pr-3 pl-9 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          />
        </div>
        <MultiSelect
          label="Category"
          options={categoryOptions}
          selected={filters.categories}
          onChange={(categories) => onChange({ ...filters, categories })}
        />
        <MultiSelect
          label="Defect type"
          options={defectOptions}
          selected={filters.defectTypes}
          onChange={(defectTypes) => onChange({ ...filters, defectTypes })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ResultToggles selected={filters.results} onChange={(results) => onChange({ ...filters, results })} />
        <DateRange
          from={filters.from}
          to={filters.to}
          onFrom={(from) => onChange({ ...filters, from })}
          onTo={(to) => onChange({ ...filters, to })}
        />
      </div>

      <FilterChips filters={filters} onChange={onChange} onClearAll={onClearAll} />
    </section>
  );
}

// Option lists live here so the page stays a thin composer.
export function defectTypeOptions(extraTypes: string[]): Option[] {
  const keys = Array.from(new Set([...Object.keys(DEFECT_LABEL), ...extraTypes]));
  return keys.map((value) => ({ value, label: DEFECT_LABEL[value] ?? value }));
}
