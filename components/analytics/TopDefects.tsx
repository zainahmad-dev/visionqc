"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { TopDefect } from "@/lib/analytics";
import { fmtInt, fmtPct1 } from "@/lib/chart";
import { DEFECT_LABEL } from "@/lib/types";
import ChartCard from "./ChartCard";
import DataTable from "./DataTable";

const label = (type: string) => DEFECT_LABEL[type] ?? type;

// A ranked list with proportional bars. Bars are scaled to the top defect, so
// the leader is always full width and the rest read as "how close behind".
export default function TopDefects({
  ranked,
  findingsTotal,
  animateKey,
}: {
  ranked: TopDefect[]; // already the top N
  findingsTotal: number;
  animateKey: number;
}) {
  const reduceMotion = useReducedMotion();
  const max = ranked[0]?.count ?? 0;

  return (
    <ChartCard
      title="Top 5 defect types"
      description={`Reviewed findings — ${fmtInt(findingsTotal)} in this period`}
      table={
        <DataTable
          caption="Top defect types by count and share"
          columns={[{ label: "Defect" }, { label: "Count", align: "right" }, { label: "Share", align: "right" }]}
          rows={ranked.map((d, i) => [`${i + 1}. ${label(d.type)}`, d.count, fmtPct1(d.share)])}
        />
      }
    >
      {ranked.length === 0 ? (
        <p className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-strong)] p-6 text-center text-sm text-[var(--color-text-secondary)]">
          No findings in this period.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {ranked.map((d, i) => (
            <li key={d.type} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs text-[var(--color-text-muted)]">{i + 1}</span>
              <span className="truncate text-sm text-[var(--color-text-primary)]">{label(d.type)}</span>
              <span className="text-right font-mono text-xs text-[var(--color-text-secondary)]">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{fmtInt(d.count)}</span> · {fmtPct1(d.share)}
              </span>
              <span />
              <div className="col-span-2 h-2 overflow-hidden rounded-full bg-[var(--color-border)]" aria-hidden="true">
                <motion.div
                  key={`${animateKey}-${d.type}`}
                  className="h-full rounded-full"
                  style={{ background: "var(--gradient-accent)" }}
                  initial={{ width: reduceMotion ? `${(d.count / max) * 100}%` : 0 }}
                  animate={{ width: `${(d.count / max) * 100}%` }}
                  transition={{ duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </ChartCard>
  );
}
