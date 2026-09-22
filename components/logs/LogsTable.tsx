"use client";

import type { MouseEvent } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Sparkles } from "lucide-react";
import type { Inspection } from "@/lib/types";
import {
  effCategory,
  finalFindings,
  formatClock,
  formatDay,
  logResult,
  recordTime,
  resultNote,
  type SortKey,
  type SortState,
} from "@/lib/logs";
import ConfidenceBadge from "./ConfidenceBadge";
import RecordThumb from "./RecordThumb";
import ResultBadge from "./ResultBadge";

export type OpenRecord = (id: string, trigger: HTMLElement) => void;

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: null, label: "Image", className: "w-20" },
  { key: "id", label: "ID" },
  { key: "category", label: "Category" },
  { key: "defects", label: "Findings", className: "text-right" },
  { key: "confidence", label: "Confidence" },
  { key: "status", label: "Status" },
  { key: "time", label: "Timestamp" },
];

function SortHeader({
  column,
  sort,
  onSort,
}: {
  column: (typeof COLUMNS)[number];
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const { key, label } = column;
  if (key === null) {
    return (
      <th scope="col" className={`px-3 py-3 font-medium ${column.className ?? ""}`}>
        <span className="sr-only">{label}</span>
      </th>
    );
  }

  const active = sort.key === key;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  const ariaSort = !active ? "none" : sort.dir === "asc" ? "ascending" : "descending";

  return (
    <th scope="col" aria-sort={ariaSort} className={`px-1 py-1 font-medium ${column.className ?? ""}`}>
      <button
        type="button"
        onClick={() => onSort(key)}
        className="flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-2 text-xs font-medium tracking-wide text-[var(--color-text-secondary)] uppercase transition-colors hover:text-[var(--color-text-primary)]"
        style={{ color: active ? "var(--color-text-primary)" : undefined }}
      >
        {label}
        <Icon
          size={13}
          aria-hidden="true"
          style={{ color: active ? "var(--color-accent-cyan)" : "var(--color-text-muted)" }}
        />
      </button>
    </th>
  );
}

function Row({
  inspection,
  threshold,
  highlighted,
  onOpen,
}: {
  inspection: Inspection;
  threshold: number;
  highlighted: boolean;
  onOpen: OpenRecord;
}) {
  const time = recordTime(inspection);
  const category = effCategory(inspection);
  const note = resultNote(inspection);

  // The whole row is clickable for the mouse; the ID button is the real,
  // focusable control (Enter/Space on it click-bubbles here). The button — not
  // the row — is what focus returns to when the drawer closes.
  function handleClick(e: MouseEvent<HTMLTableRowElement>) {
    const trigger = e.currentTarget.querySelector<HTMLElement>("[data-record-trigger]");
    if (trigger) onOpen(inspection.id, trigger);
  }

  return (
    <tr
      data-record-row={inspection.id}
      onClick={handleClick}
      className="scroll-mt-40 cursor-pointer border-t border-[var(--color-border)] transition-colors duration-1000 hover:bg-[var(--color-surface-raised)]"
      style={
        highlighted
          ? {
              background: "color-mix(in srgb, var(--color-accent-cyan) 14%, transparent)",
              boxShadow: "inset 3px 0 0 var(--color-accent-cyan)",
            }
          : undefined
      }
    >
      <td className="px-3 py-2">
        <RecordThumb url={inspection.image_url} className="h-11 w-14" />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            data-record-trigger={inspection.id}
            aria-haspopup="dialog"
            className="flex min-h-11 items-center rounded-[var(--radius-control)] font-mono text-sm whitespace-nowrap text-[var(--color-text-primary)] underline-offset-4 hover:underline"
          >
            {inspection.id}
          </button>
          {highlighted && (
            <span className="-mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-cyan)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent-cyan)]">
              <Sparkles size={11} aria-hidden="true" />
              Just saved
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">
        {category ?? <span className="text-[var(--color-text-muted)]">Uncategorized</span>}
      </td>
      <td className="px-3 py-2 text-right font-mono text-sm text-[var(--color-text-primary)]">
        {finalFindings(inspection).length}
      </td>
      <td className="px-3 py-2">
        <ConfidenceBadge value={inspection.category_confidence} threshold={threshold} />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col items-start gap-1">
          <ResultBadge result={logResult(inspection)} />
          {note && <span className="text-[11px] text-[var(--color-text-muted)]">{note}</span>}
        </div>
      </td>
      <td className="px-3 py-2 whitespace-nowrap">
        <time dateTime={new Date(time).toISOString()} className="flex flex-col font-mono text-xs">
          <span className="text-[var(--color-text-primary)]">{formatDay(time)}</span>
          <span className="text-[var(--color-text-muted)]">{formatClock(time)}</span>
        </time>
      </td>
    </tr>
  );
}

export default function LogsTable({
  records,
  sort,
  onSort,
  threshold,
  highlightId,
  onOpen,
}: {
  records: Inspection[];
  sort: SortState;
  onSort: (key: SortKey) => void;
  threshold: number;
  highlightId: string | null;
  onOpen: OpenRecord;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full min-w-[820px] text-left">
        <caption className="sr-only">
          Inspection records. Use the column buttons to sort; select a row to open its details.
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <SortHeader key={column.label} column={column} sort={sort} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((inspection) => (
            <Row
              key={inspection.id}
              inspection={inspection}
              threshold={threshold}
              highlighted={inspection.id === highlightId}
              onOpen={onOpen}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
