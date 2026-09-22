import type { View } from "./ViewToggle";

const ROWS = 8;

function Bar({ className }: { className: string }) {
  return <div className={`motion-safe:animate-pulse rounded bg-[var(--color-border)] ${className}`} />;
}

// Placeholder rows shaped like the real ones, so the page doesn't jump when
// data arrives. Hidden from assistive tech — the page's live region announces
// the loading state once instead of per bar.
export default function LogsSkeleton({ view }: { view: View }) {
  if (view === "grid") {
    return (
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <li
            key={i}
            className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
          >
            <Bar className="aspect-[4/3] w-full rounded-[var(--radius-control)]" />
            <Bar className="mt-3 h-4 w-24" />
            <Bar className="mt-2 h-3 w-40" />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
      aria-hidden="true"
    >
      {Array.from({ length: ROWS }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-t border-[var(--color-border)] p-3 first:border-t-0">
          <Bar className="h-10 w-14 shrink-0 rounded-[var(--radius-control)]" />
          <Bar className="h-4 w-20" />
          <Bar className="h-4 w-32" />
          <Bar className="hidden h-4 w-10 sm:block" />
          <Bar className="hidden h-5 w-14 rounded-full md:block" />
          <Bar className="h-6 w-24 rounded-full" />
          <Bar className="ml-auto hidden h-4 w-24 lg:block" />
        </div>
      ))}
    </div>
  );
}
