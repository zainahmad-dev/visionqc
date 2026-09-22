import type { ReactNode } from "react";
import { CheckCheck, CircleDashed, ScanSearch, TriangleAlert, Upload, type LucideIcon } from "lucide-react";
import type { Inspection } from "@/lib/types";
import { ERROR_REASON } from "@/lib/scan";
import {
  RESULT_LABEL,
  effCategory,
  estimatedAnalyzedAt,
  finalFindings,
  formatDateTime,
  formatDuration,
  logResult,
} from "@/lib/logs";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type Step = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  time: number | null;
  approx?: boolean; // the time is an estimate, not a recorded value
  since?: number; // gap from the previous step, ms
  detail: ReactNode;
  pending?: boolean;
};

function buildSteps(inspection: Inspection): Step[] {
  const analyzedAt = estimatedAnalyzedAt(inspection);
  const failed = inspection.error_code !== null;

  const steps: Step[] = [
    {
      key: "uploaded",
      label: "Uploaded",
      icon: Upload,
      color: "var(--color-accent-cyan)",
      time: inspection.created_at,
      detail: <span className="font-mono">{inspection.file_name}</span>,
    },
    {
      key: "analyzed",
      label: failed ? "Analysis failed" : "Analyzed",
      icon: failed ? TriangleAlert : ScanSearch,
      color: failed ? "var(--color-review)" : "var(--color-indigo-text)",
      time: analyzedAt,
      approx: true,
      since: analyzedAt - inspection.created_at,
      detail: failed
        ? ERROR_REASON[inspection.error_code!]
        : `${plural(inspection.defects.filter((d) => d.ai_type !== null).length, "finding")} proposed${
            inspection.category ? ` · category ${inspection.category}` : ""
          }`,
    },
  ];

  if (inspection.reviewed_at !== null) {
    const result = logResult(inspection);
    steps.push({
      key: "reviewed",
      label: "Reviewed & saved",
      icon: CheckCheck,
      color: "var(--color-pass)",
      time: inspection.reviewed_at,
      since: inspection.reviewed_at - analyzedAt,
      detail: `${RESULT_LABEL[result]}${
        inspection.result_mode === "auto" ? "" : " (reviewer override)"
      } · ${plural(finalFindings(inspection).length, "final finding")} · ${effCategory(inspection) ?? "no category"}`,
    });
  } else {
    steps.push({
      key: "reviewed",
      label: "Awaiting manual review",
      icon: CircleDashed,
      color: "var(--color-text-muted)",
      time: null,
      detail: "Not saved yet — open it in Review to resolve it.",
      pending: true,
    });
  }

  return steps;
}

export default function TimelineTab({ inspection }: { inspection: Inspection }) {
  const steps = buildSteps(inspection);

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const last = index === steps.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
              {!last && (
                <span
                  className="absolute top-9 bottom-0 left-[15px] w-px bg-[var(--color-border-strong)]"
                  aria-hidden="true"
                />
              )}
              <span
                className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[var(--color-surface)]"
                style={{ borderColor: step.color, color: step.color, borderStyle: step.pending ? "dashed" : "solid" }}
              >
                <Icon size={15} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{step.label}</p>
                {step.time !== null ? (
                  <p className="font-mono text-xs text-[var(--color-text-secondary)]">
                    <time dateTime={new Date(step.time).toISOString()}>
                      {step.approx ? "≈ " : ""}
                      {formatDateTime(step.time)}
                    </time>
                    {step.since !== undefined && (
                      <span className="text-[var(--color-text-muted)]"> · +{formatDuration(step.since)}</span>
                    )}
                    {step.approx && <span className="text-[var(--color-text-muted)]"> · estimated</span>}
                  </p>
                ) : (
                  <p className="font-mono text-xs text-[var(--color-text-muted)]">—</p>
                )}
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Upload and review times are recorded. The analysis time is estimated from the scan duration until
        the database stores it.
      </p>
    </div>
  );
}
