import { CircleAlert } from "lucide-react";
import { DEFECT_LABEL, SEVERITY_LABEL, type BBox, type Defect, type Inspection, type Review } from "@/lib/types";
import { effBox, effSeverity, effType } from "@/lib/rules";

// In a finalized record a "pending" defect was never touched: it sat above the
// threshold and was accepted as proposed (Finalize refuses anything below it).
const REVIEW_WORD: Record<Review, string> = {
  pending: "not reviewed",
  confirmed: "confirmed",
  edited: "edited",
  dismissed: "dismissed",
  reviewer_added: "added",
};

const REVIEW_COLOR: Record<Review, string> = {
  pending: "var(--color-text-muted)",
  confirmed: "var(--color-pass)",
  edited: "var(--color-indigo-text)",
  dismissed: "var(--color-text-muted)",
  reviewer_added: "var(--color-indigo-text)",
};

function labelFor(type: string | null): string {
  if (!type) return "Unlabeled";
  return DEFECT_LABEL[type] ?? type;
}

const pct = (n: number) => `${Math.round(n * 100)}`;
function formatBox(b: BBox): string {
  return `${pct(b.x)},${pct(b.y)} · ${pct(b.w)}×${pct(b.h)}%`;
}

function Cell({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 p-3">
      <span className="text-[10px] font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
        {heading}
      </span>
      {children}
    </div>
  );
}

// AI values on the left are immutable; reviewer changes on the right are stored
// separately — this card is where both are shown side by side.
function FindingCard({ defect, index, threshold }: { defect: Defect; index: number; threshold: number }) {
  const dismissed = defect.review === "dismissed";
  const aiPct = defect.ai_confidence !== null ? Math.round(defect.ai_confidence * 100) : null;
  const belowThreshold = aiPct !== null && aiPct < threshold;

  const type = effType(defect);
  const severity = effSeverity(defect);
  const box = effBox(defect);
  const severityEdited = defect.edited?.severity !== undefined && defect.edited.severity !== defect.ai_severity;
  const boxEdited = defect.edited?.bbox !== undefined;
  const strike = dismissed ? "line-through" : "";

  return (
    <li className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-border)] px-1 font-mono text-[11px] font-semibold text-[var(--color-text-primary)]">
          {index + 1}
        </span>
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ borderColor: REVIEW_COLOR[defect.review], color: REVIEW_COLOR[defect.review] }}
        >
          {REVIEW_WORD[defect.review]}
        </span>
        {belowThreshold && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-review)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-review)]">
            <CircleAlert size={11} aria-hidden="true" />
            Below {threshold}% threshold
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 divide-y divide-[var(--color-border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Cell heading="AI proposed">
          {defect.ai_type === null ? (
            <p className="text-sm text-[var(--color-text-secondary)]">AI: no value — added by reviewer</p>
          ) : (
            <>
              <p className="font-mono text-sm text-[var(--color-text-primary)]">
                AI: {labelFor(defect.ai_type)} {aiPct !== null ? `${aiPct}%` : "—"}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Severity: {defect.ai_severity ? SEVERITY_LABEL[defect.ai_severity] : "—"}
              </p>
              <p className="font-mono text-xs text-[var(--color-text-muted)]">
                Box: {defect.ai_bbox ? formatBox(defect.ai_bbox) : "—"}
              </p>
            </>
          )}
        </Cell>

        <Cell heading="Reviewed">
          <p className={`font-mono text-sm text-[var(--color-text-primary)] ${strike}`}>
            Reviewed: {labelFor(type)} ({REVIEW_WORD[defect.review]})
          </p>
          <p className={`text-xs text-[var(--color-text-secondary)] ${strike}`}>
            Severity: {severity ? SEVERITY_LABEL[severity] : "—"}
            {severityEdited && <span className="text-[var(--color-indigo-text)]"> (edited)</span>}
          </p>
          <p className={`font-mono text-xs text-[var(--color-text-muted)] ${strike}`}>
            Box: {box ? formatBox(box) : "—"}
            {boxEdited && <span className="text-[var(--color-indigo-text)]"> (adjusted)</span>}
          </p>
          {dismissed && (
            <p className="text-xs text-[var(--color-text-secondary)]">Dismissed as a false positive.</p>
          )}
        </Cell>
      </div>
    </li>
  );
}

export default function FindingsTab({
  inspection,
  threshold,
}: {
  inspection: Inspection;
  threshold: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      {inspection.defects.length === 0 ? (
        <p className="rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-strong)] p-4 text-sm text-[var(--color-text-secondary)]">
          {inspection.status === "completed"
            ? "No defects were proposed or added for this record."
            : "No findings — the AI output couldn't be used for this record."}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {inspection.defects.map((defect, index) => (
            <FindingCard key={defect.id} defect={defect} index={index} threshold={threshold} />
          ))}
        </ol>
      )}

      <section aria-labelledby="reviewer-notes-heading">
        <h3
          id="reviewer-notes-heading"
          className="mb-1.5 text-[10px] font-medium tracking-wide text-[var(--color-text-muted)] uppercase"
        >
          Reviewer notes
        </h3>
        {inspection.notes.trim() ? (
          <p className="rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm whitespace-pre-wrap text-[var(--color-text-primary)]">
            {inspection.notes}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">No notes were added.</p>
        )}
      </section>
    </div>
  );
}
