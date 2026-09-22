import { X } from "lucide-react";
import { DEFECT_LABEL } from "@/lib/types";
import {
  NO_CATEGORY,
  RESULT_LABEL,
  dayStart,
  formatDay,
  type LogFilters,
} from "@/lib/logs";

type ChipSpec = { key: string; group: string; value: string; onRemove: () => void };

function isoLabel(iso: string): string {
  const start = dayStart(iso);
  return start === null ? iso : formatDay(start);
}

// One chip per active value — so a three-category filter is three removable
// chips, not one opaque blob. The ✕ has a 44px hit area via the pseudo-element.
function buildChips(filters: LogFilters, onChange: (next: LogFilters) => void): ChipSpec[] {
  const chips: ChipSpec[] = [];

  if (filters.query.trim()) {
    chips.push({
      key: "query",
      group: "Search",
      value: `“${filters.query.trim()}”`,
      onRemove: () => onChange({ ...filters, query: "" }),
    });
  }
  for (const c of filters.categories) {
    chips.push({
      key: `cat:${c}`,
      group: "Category",
      value: c === NO_CATEGORY ? "Uncategorized" : c,
      onRemove: () => onChange({ ...filters, categories: filters.categories.filter((v) => v !== c) }),
    });
  }
  for (const r of filters.results) {
    chips.push({
      key: `res:${r}`,
      group: "Result",
      value: RESULT_LABEL[r],
      onRemove: () => onChange({ ...filters, results: filters.results.filter((v) => v !== r) }),
    });
  }
  for (const t of filters.defectTypes) {
    chips.push({
      key: `def:${t}`,
      group: "Defect",
      value: DEFECT_LABEL[t] ?? t,
      onRemove: () => onChange({ ...filters, defectTypes: filters.defectTypes.filter((v) => v !== t) }),
    });
  }
  if (filters.from) {
    chips.push({
      key: "from",
      group: "From",
      value: isoLabel(filters.from),
      onRemove: () => onChange({ ...filters, from: "" }),
    });
  }
  if (filters.to) {
    chips.push({
      key: "to",
      group: "To",
      value: isoLabel(filters.to),
      onRemove: () => onChange({ ...filters, to: "" }),
    });
  }
  return chips;
}

export default function FilterChips({
  filters,
  onChange,
  onClearAll,
}: {
  filters: LogFilters;
  onChange: (next: LogFilters) => void;
  onClearAll: () => void;
}) {
  const chips = buildChips(filters, onChange);
  if (chips.length === 0) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((chip) => (
        <li
          key={chip.key}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] pl-3 text-xs text-[var(--color-text-secondary)]"
        >
          <span>{chip.group}:</span>
          <span className="max-w-40 truncate font-medium text-[var(--color-text-primary)]">{chip.value}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove filter ${chip.group}: ${chip.value}`}
            className="relative flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:text-[var(--color-fail)]"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={onClearAll}
          className="relative flex h-8 items-center rounded-full px-3 text-xs font-medium text-[var(--color-accent-cyan)] transition-colors after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-[''] hover:underline"
        >
          Clear all
        </button>
      </li>
    </ul>
  );
}
