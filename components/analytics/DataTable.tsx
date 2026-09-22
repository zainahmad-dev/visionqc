// The table view behind every chart: the same numbers, as text. Formatting is
// done by the caller with the SAME formatters the chart and tooltip use.

export type Column = { label: string; align?: "left" | "right" };

export default function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: Column[];
  rows: (string | number)[][];
}) {
  return (
    // Scrollable regions must be focusable, or keyboard users can't reach the overflow.
    <div
      tabIndex={0}
      role="region"
      aria-label={caption}
      className="max-h-80 overflow-auto rounded-[var(--radius-control)] border border-[var(--color-border)]"
    >
      <table className="w-full min-w-[320px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-[var(--color-surface-raised)]">
          <tr>
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={`px-3 py-2 text-[11px] font-medium tracking-wide text-[var(--color-text-secondary)] uppercase ${
                  c.align === "right" ? "text-right" : ""
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-[var(--color-border)]">
              {row.map((cell, c) =>
                c === 0 ? (
                  <th key={c} scope="row" className="px-3 py-1.5 font-normal whitespace-nowrap text-[var(--color-text-primary)]">
                    {cell}
                  </th>
                ) : (
                  <td
                    key={c}
                    className={`px-3 py-1.5 font-mono text-[13px] text-[var(--color-text-primary)] ${
                      columns[c]?.align === "right" ? "text-right" : ""
                    }`}
                  >
                    {cell}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
