import { BadgeCheck, TriangleAlert } from "lucide-react";

// Overall AI confidence for a record, judged against the reviewer's threshold.
// Below it the badge turns amber with a warning icon — never colour alone.
export default function ConfidenceBadge({
  value,
  threshold,
}: {
  value: number | null;
  threshold: number;
}) {
  if (value === null) {
    return (
      <span className="font-mono text-xs text-[var(--color-text-muted)]">
        —<span className="sr-only">No confidence recorded</span>
      </span>
    );
  }

  const pct = Math.round(value * 100);
  const below = pct < threshold;
  const color = below ? "var(--color-review)" : "var(--color-accent-cyan)";
  const Icon = below ? TriangleAlert : BadgeCheck;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs font-medium"
      style={{ borderColor: color, color }}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {pct}%
      <span className="sr-only">{below ? `, below the ${threshold}% threshold` : ", above the threshold"}</span>
    </span>
  );
}
