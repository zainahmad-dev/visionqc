"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";

type Schema = { status: "valid" | "invalid" | "none"; text: string };

function parseSchema(raw: string | null): Schema {
  if (raw === null) return { status: "none", text: "" };
  try {
    const parsed = JSON.parse(raw);
    return { status: "valid", text: JSON.stringify(parsed, null, 2) };
  } catch {
    return { status: "invalid", text: raw };
  }
}

// Keys → accent, strings → default ink, numbers → indigo, true/false/null →
// review. No dangerouslySetInnerHTML — tokens render as plain React text.
const JSON_TOKEN_RE = /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function highlightJson(text: string): ReactNode[] {
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
    else color = "var(--color-accent-indigo)";
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

const SCHEMA_META: Record<Schema["status"], { label: string; color: string }> = {
  valid: { label: "Schema valid", color: "var(--color-pass)" },
  invalid: { label: "Schema invalid", color: "var(--color-fail)" },
  none: { label: "No output", color: "var(--color-text-muted)" },
};

export default function RawOutputCard({ rawOutput }: { rawOutput: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const schema = parseSchema(rawOutput);
  const meta = SCHEMA_META[schema.status];

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
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        )}
      </summary>
      <div className="border-t border-[var(--color-border)] p-3">
        {schema.status === "none" ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No output was produced for this record.
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
