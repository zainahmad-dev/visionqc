"use client";

import { Sparkles } from "lucide-react";
import type { Inspection } from "@/lib/types";
import {
  effCategory,
  finalFindings,
  formatDateTime,
  logResult,
  recordTime,
  resultNote,
} from "@/lib/logs";
import ConfidenceBadge from "./ConfidenceBadge";
import RecordThumb from "./RecordThumb";
import ResultBadge from "./ResultBadge";
import type { OpenRecord } from "./LogsTable";

function Card({
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
  const findings = finalFindings(inspection).length;
  const note = resultNote(inspection);
  const time = recordTime(inspection);

  return (
    <li>
      <button
        type="button"
        data-record-trigger={inspection.id}
        aria-haspopup="dialog"
        onClick={(e) => onOpen(inspection.id, e.currentTarget)}
        className="flex h-full w-full flex-col gap-3 rounded-[var(--radius-card)] border bg-[var(--color-surface)] p-3 text-left transition-colors duration-1000 hover:border-[var(--color-accent-cyan)] hover:bg-[var(--color-surface-raised)]"
        style={{
          borderColor: highlighted ? "var(--color-accent-cyan)" : "var(--color-border)",
          background: highlighted ? "color-mix(in srgb, var(--color-accent-cyan) 14%, var(--color-surface))" : undefined,
        }}
      >
        <RecordThumb url={inspection.image_url} className="aspect-[4/3] w-full" />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-sm text-[var(--color-text-primary)]">{inspection.id}</span>
          <ResultBadge result={logResult(inspection)} />
        </div>

        {highlighted && (
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[var(--color-accent-cyan)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-accent-cyan)]">
            <Sparkles size={11} aria-hidden="true" />
            Just saved
          </span>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm text-[var(--color-text-primary)]">
            {effCategory(inspection) ?? <span className="text-[var(--color-text-muted)]">Uncategorized</span>}
          </p>
          {note && <p className="text-[11px] text-[var(--color-text-muted)]">{note}</p>}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
          <span>
            <span className="font-mono text-[var(--color-text-primary)]">{findings}</span>{" "}
            {findings === 1 ? "finding" : "findings"}
          </span>
          <ConfidenceBadge value={inspection.category_confidence} threshold={threshold} />
        </div>
        <time dateTime={new Date(time).toISOString()} className="font-mono text-[11px] text-[var(--color-text-muted)]">
          {formatDateTime(time)}
        </time>
      </button>
    </li>
  );
}

export default function LogsGrid({
  records,
  threshold,
  highlightId,
  onOpen,
}: {
  records: Inspection[];
  threshold: number;
  highlightId: string | null;
  onOpen: OpenRecord;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {records.map((inspection) => (
        <Card
          key={inspection.id}
          inspection={inspection}
          threshold={threshold}
          highlighted={inspection.id === highlightId}
          onOpen={onOpen}
        />
      ))}
    </ul>
  );
}
