import Link from "next/link";

// Hand-drawn SVG: a stack of record cards with a magnifier over it. Uses the
// theme tokens, so it follows dark/light.
function EmptyIllustration() {
  return (
    <svg width="132" height="104" viewBox="0 0 132 104" fill="none" aria-hidden="true">
      <rect x="14" y="14" width="84" height="60" rx="10" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      <rect x="22" y="24" width="84" height="60" rx="10" fill="var(--color-surface)" stroke="var(--color-border-strong)" strokeWidth="1.5" />
      <rect x="32" y="36" width="20" height="16" rx="4" fill="var(--color-border)" />
      <rect x="60" y="36" width="34" height="5" rx="2.5" fill="var(--color-border-strong)" />
      <rect x="60" y="47" width="22" height="5" rx="2.5" fill="var(--color-border)" />
      <rect x="32" y="60" width="62" height="5" rx="2.5" fill="var(--color-border)" />
      <circle cx="94" cy="66" r="18" fill="var(--color-bg)" stroke="url(#empty-ring)" strokeWidth="3" />
      <path d="M107 79l14 14" stroke="var(--color-accent-indigo)" strokeWidth="4" strokeLinecap="round" />
      <path d="M87 60l14 12M101 60L87 72" stroke="var(--color-text-muted)" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="empty-ring" x1="76" y1="48" x2="112" y2="84" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-accent-cyan)" />
          <stop offset="1" stopColor="var(--color-accent-indigo)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean; // true = filters hid everything; false = nothing saved yet
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-14 text-center">
      <EmptyIllustration />
      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
        {filtered ? "No records match these filters" : "No saved records yet"}
      </h2>
      <p className="max-w-sm text-sm text-[var(--color-text-secondary)]">
        {filtered
          ? "Try a different search, or widen the result, category, defect type or date range."
          : "Finalized inspections and records that need a manual look will appear here."}
      </p>
      {filtered ? (
        <button
          type="button"
          onClick={onClear}
          className="flex h-11 items-center rounded-[var(--radius-control)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--gradient-accent-strong)" }}
        >
          Clear filters
        </button>
      ) : (
        <Link
          href="/hub"
          className="flex h-11 items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
        >
          Go to the Hub to scan an image
        </Link>
      )}
    </div>
  );
}
