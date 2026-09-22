import { LayoutGrid, Rows3 } from "lucide-react";

export type View = "table" | "grid";

const VIEWS: { value: View; label: string; icon: typeof Rows3 }[] = [
  { value: "table", label: "Table", icon: Rows3 },
  { value: "grid", label: "Grid", icon: LayoutGrid },
];

// Segmented control — two real buttons, the current one marked aria-pressed.
export default function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div
      role="group"
      aria-label="Layout"
      className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1"
    >
      {VIEWS.map(({ value, label, icon: Icon }) => {
        const active = view === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            aria-label={label}
            onClick={() => onChange(value)}
            className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-[6px] px-3 text-sm transition-colors"
            style={{
              color: active ? "var(--color-accent-cyan)" : "var(--color-text-secondary)",
              background: active ? "color-mix(in srgb, var(--color-accent-cyan) 14%, transparent)" : "transparent",
            }}
          >
            <Icon size={15} aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
