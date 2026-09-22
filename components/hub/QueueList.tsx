"use client";

import { Trash2 } from "lucide-react";
import type { Inspection } from "@/lib/types";
import StatusBadge from "@/components/StatusBadge";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function QueueCard({
  inspection,
  isActive,
  isChecked,
  onSelect,
  onToggleCheck,
  onRemove,
}: {
  inspection: Inspection;
  isActive: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onToggleCheck: () => void;
  onRemove: () => void;
}) {
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] border p-2 text-left transition-colors sm:flex-nowrap sm:gap-3"
        style={{
          borderColor: isActive ? "var(--color-accent-cyan)" : "var(--color-border)",
          background: isActive ? "var(--color-surface-raised)" : "var(--color-surface)",
        }}
      >
        <label
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={isChecked}
            onChange={onToggleCheck}
            aria-label={`Select ${inspection.id}`}
            className="h-4 w-4 accent-[var(--color-accent-cyan)]"
          />
        </label>

        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-border)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- locally-decoded blob URLs */}
          <img src={inspection.image_url} alt="" className="h-full w-full object-cover" />
        </div>

        {/* On a phone the ID gets a floor, so the badge and delete button wrap to a second
            line instead of squeezing "VQ-10421" down to "VQ-10…". */}
        <div className="min-w-[8.5rem] flex-1 sm:min-w-0">
          <p className="truncate font-mono text-xs text-[var(--color-text-primary)]">{inspection.id}</p>
          <p className="truncate text-xs text-[var(--color-text-secondary)]">{inspection.file_name}</p>
        </div>

        <StatusBadge status={inspection.status} />

        <button
          type="button"
          aria-label={`Remove ${inspection.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-fail)]"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export default function QueueList({
  items,
  activeId,
  checked,
  onSelect,
  onToggleCheck,
  onRemove,
}: {
  items: Inspection[];
  activeId: string | null;
  checked: Set<string>;
  onSelect: (id: string) => void;
  onToggleCheck: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
        No inspections in the pipeline. Drop a file above to get started.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((inspection) => (
        <QueueCard
          key={inspection.id}
          inspection={inspection}
          isActive={inspection.id === activeId}
          isChecked={checked.has(inspection.id)}
          onSelect={() => onSelect(inspection.id)}
          onToggleCheck={() => onToggleCheck(inspection.id)}
          onRemove={() => onRemove(inspection.id)}
        />
      ))}
    </ul>
  );
}
