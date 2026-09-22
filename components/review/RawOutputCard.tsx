"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import type { ScanAttempt } from "@/lib/store";
import type { ErrorCode } from "@/lib/types";

type Schema = { status: "valid" | "invalid" | "none"; text: string };

// `knownInvalid`: the app already knows this attempt failed (error_code
// 'invalid_json') even though the text happens to be syntactically valid
// JSON — Ollama's constrained decoding guarantees syntax, not that the model
// picked values our schema actually allows (e.g. an enum outside the set).
// Without this, a schema-rejected-but-parseable response would show "Schema
// valid" beside a Needs Manual Review record, which is the wrong story.
export function parseSchema(raw: string | null, knownInvalid = false): Schema {
  if (raw === null) return { status: "none", text: "" };
  try {
    const parsed = JSON.parse(raw);
    return { status: knownInvalid ? "invalid" : "valid", text: knownInvalid ? raw : JSON.stringify(parsed, null, 2) };
  } catch {
    return { status: "invalid", text: raw };
  }
}

// Keys → accent, strings → default ink, numbers → indigo, true/false/null →
// review. No dangerouslySetInnerHTML — tokens render as plain React text.
const JSON_TOKEN_RE = /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

export function highlightJson(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  JSON_TOKEN_RE.lastIndex = 0;
  while ((match = JSON_TOKEN_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    let color = "var(--color-text-primary)";
    if (/^".*":$/.test(token)) color = "var(--color-accent-cyan)";
    else if (/^"/.test(token)) color = "var(--color-pass)";
    else if (/^(true|false|null)$/.test(token)) color = "var(--color-review)";
    else color = "var(--color-indigo-text)";
    nodes.push(
      <span key={key++} style={{ color }}>
        {token}
      </span>
    );
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export const SCHEMA_META: Record<Schema["status"], { label: string; color: string }> = {
  valid: { label: "Schema valid", color: "var(--color-pass)" },
  invalid: { label: "Schema invalid", color: "var(--color-fail)" },
  none: { label: "No output", color: "var(--color-text-muted)" },
};

export default function RawOutputCard({
  rawOutput,
  errorCode = null,
  history = [],
}: {
  rawOutput: string | null;
  // The current attempt's error_code, if any — 'invalid_json' forces the chip
  // to "Schema invalid" even when the text itself parses fine (see parseSchema).
  errorCode?: ErrorCode | null;
  // Superseded attempts from earlier retries, oldest first — CLAUDE.md rule 3:
  // nothing is discarded, so a Retry doesn't just quietly replace what came
  // before. Empty on a record that's never been retried, and always empty for
  // an already-saved one (only the current attempt is ever persisted).
  history?: ScanAttempt[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  type Attempt = Omit<ScanAttempt, "at"> & { at: number | null };
  const attempts: Attempt[] = [...history, { raw_output: rawOutput, error_code: errorCode, at: null }];
  const latestIndex = attempts.length - 1;
  const [index, setIndex] = useState(latestIndex);

  // A new attempt landed (Retry finished, or the very first scan just did) —
  // snap back to showing the current one rather than silently leaving an old
  // attempt on screen. Adjusted during render (React's documented pattern for
  // resetting state on a prop change without a key-remount), not in an effect.
  const [seenLatestIndex, setSeenLatestIndex] = useState(latestIndex);
  if (latestIndex !== seenLatestIndex) {
    setSeenLatestIndex(latestIndex);
    setIndex(latestIndex);
  }

  const viewing = attempts[index];
  const schema = parseSchema(viewing.raw_output, viewing.error_code === "invalid_json");
  const meta = SCHEMA_META[schema.status];
  const isCurrent = index === latestIndex;
  const hasHistory = attempts.length > 1;

  async function handleCopy(e: MouseEvent) {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(schema.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied — the text is still visible to select manually.
    }
  }

  return (
    <details
      className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium text-[var(--color-text-primary)] select-none">
        <ChevronDown
          size={14}
          className="shrink-0 text-[var(--color-text-muted)] transition-transform"
          style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
        Raw structured output
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
          style={{ borderColor: meta.color, color: meta.color }}
        >
          {meta.label}
        </span>
        {schema.status !== "none" && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy raw output"
            className="-my-2 ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </summary>
      <div className="border-t border-[var(--color-border)] p-3">
        {hasHistory && (
          <div className="mb-3 flex items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous attempt"
                disabled={index === 0}
                onClick={(e) => {
                  e.preventDefault();
                  setIndex((i) => Math.max(0, i - 1));
                }}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] transition-colors enabled:hover:text-[var(--color-text-primary)] disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="font-mono">
                Attempt {index + 1} of {attempts.length}
                {isCurrent && " (current)"}
              </span>
              <button
                type="button"
                aria-label="Next attempt"
                disabled={isCurrent}
                onClick={(e) => {
                  e.preventDefault();
                  setIndex((i) => Math.min(latestIndex, i + 1));
                }}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] transition-colors enabled:hover:text-[var(--color-text-primary)] disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            {viewing.at && <span>{new Date(viewing.at).toLocaleTimeString()}</span>}
          </div>
        )}
        {schema.status === "none" ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No output was produced for this {isCurrent ? "record" : "attempt"}.
          </p>
        ) : (
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-[var(--color-text-secondary)]">
            {highlightJson(schema.text)}
          </pre>
        )}
      </div>
    </details>
  );
}
