"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type Option = { value: string; label: string };

// A disclosure of native checkboxes. Escape closes it and returns focus to the
// button; clicking or tabbing away closes it too.
export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onFocusIn(e: FocusEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const active = selected.length > 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2 rounded-[var(--radius-control)] border bg-[var(--color-surface-raised)] px-3 text-sm text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
        style={{ borderColor: active ? "var(--color-accent-cyan)" : "var(--color-border-strong)" }}
      >
        {label}
        {active && (
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-semibold text-white"
            style={{ background: "var(--gradient-accent-strong)" }}
          >
            {selected.length}
            <span className="sr-only"> selected</span>
          </span>
        )}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="text-[var(--color-text-muted)] transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="group"
          aria-label={label}
          className="absolute top-full left-0 z-40 mt-1 max-h-72 w-60 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] p-1 shadow-lg"
        >
          {options.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
                className="h-4 w-4 shrink-0 accent-[var(--color-accent-cyan)]"
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
