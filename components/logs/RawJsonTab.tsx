"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Inspection } from "@/lib/types";
import { ERROR_REASON } from "@/lib/scan";
import { highlightJson, parseSchema, SCHEMA_META } from "@/components/review/RawOutputCard";

// The model's exact output, read-only. Invalid JSON is shown verbatim (never
// repaired or hidden) under a red "Schema invalid" chip.
export default function RawJsonTab({ inspection }: { inspection: Inspection }) {
  const [copied, setCopied] = useState(false);
  const schema = parseSchema(inspection.raw_output);
  const meta = SCHEMA_META[schema.status];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(schema.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied — the text is still there to select.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
          style={{ borderColor: meta.color, color: meta.color }}
        >
          {meta.label}
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">Read-only</span>
        {schema.status !== "none" && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : "Copy raw output"}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          </button>
        )}
      </div>

      {inspection.error_code && (
        <p className="rounded-[var(--radius-control)] border border-[var(--color-review)] bg-[var(--color-review)]/10 px-3 py-2 text-xs text-[var(--color-text-primary)]">
          {ERROR_REASON[inspection.error_code]}
        </p>
      )}

      {schema.status === "none" ? (
        <p className="text-sm text-[var(--color-text-secondary)]">No output was produced for this record.</p>
      ) : (
        <pre
          tabIndex={0}
          aria-label="Raw model output, read-only"
          className="max-h-96 overflow-auto rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-[var(--color-text-secondary)]"
        >
          {highlightJson(schema.text)}
        </pre>
      )}
    </div>
  );
}
