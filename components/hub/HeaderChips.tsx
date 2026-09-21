import type { Inspection } from "@/lib/types";

function count(items: Inspection[], predicate: (i: Inspection) => boolean): number {
  return items.reduce((n, i) => n + (predicate(i) ? 1 : 0), 0);
}

export default function HeaderChips({ items }: { items: Inspection[] }) {
  const chips = [
    { label: "Queued", value: count(items, (i) => i.status === "queued"), color: "var(--color-text-muted)" },
    {
      label: "Scanning",
      value: count(items, (i) => i.status === "scanning"),
      color: "var(--color-accent-cyan)",
    },
    {
      label: "Ready to Review",
      value: count(items, (i) => i.status === "analyzed"),
      color: "var(--color-accent-indigo)",
    },
    {
      label: "Needs Manual Review",
      value: count(items, (i) => i.status === "needs_manual_review" || i.status === "failed"),
      color: "var(--color-review)",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <div
          key={chip.label}
          className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs"
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: chip.color }} />
          <span className="font-mono font-medium text-[var(--color-text-primary)]">{chip.value}</span>
          <span className="text-[var(--color-text-secondary)]">{chip.label}</span>
        </div>
      ))}
    </div>
  );
}
