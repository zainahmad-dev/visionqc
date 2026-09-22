"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Inspection } from "@/lib/types";
import { effCategory, formatDateTime, recordTime } from "@/lib/logs";
import { SEARCH_INPUT_ID } from "./FilterBar";
import DrawerImage from "./DrawerImage";
import DrawerSummary from "./DrawerSummary";
import DrawerTabs, { type TabId } from "./DrawerTabs";
import { useDialogFocus } from "@/components/useDialogFocus";

// document.body only exists client-side — the React-sanctioned way to read
// that without a synchronous setState-in-effect (same approach as Modal).
function subscribeNever() {
  return () => {};
}
const isClient = () => true;
const isServer = () => false;

function HeaderButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  // aria-disabled (not `disabled`) so focus isn't dropped when the reviewer
  // steps onto the first or last record with the button they just pressed.
  return (
    <button
      type="button"
      aria-label={label}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent-cyan)] hover:text-[var(--color-text-primary)]"
      style={{ opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </button>
  );
}

// Slides in from the right. Portaled to <body>: PageTransition wraps every page
// in a transformed motion.div, which would otherwise pin a position:fixed
// backdrop to that box instead of the viewport.
//
// `record` is the record on show (null = closed); `index` / `total` place it in
// the FILTERED, SORTED list, so prev/next walk what the reviewer is looking at.
export default function RecordDrawer({
  record,
  index,
  total,
  threshold,
  returnFocusRef,
  onPrev,
  onNext,
  onClose,
}: {
  record: Inspection | null;
  index: number; // -1 if the record isn't in the current list
  total: number;
  threshold: number;
  returnFocusRef: RefObject<HTMLElement | null>;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const mounted = useSyncExternalStore(subscribeNever, isClient, isServer);
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [tab, setTab] = useState<TabId>("findings");

  const open = record !== null;
  const recordId = record?.id ?? null;

  useDialogFocus({ open, panelRef, onClose, returnFocusRef, fallbackId: SEARCH_INPUT_ID });

  // A new record starts at the top, but keeps the chosen tab so a reviewer can
  // page through, say, every Raw JSON in turn.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [recordId]);

  if (!mounted) return null;

  const spring = reduceMotion
    ? { duration: 0.01 }
    : ({ type: "spring", stiffness: 380, damping: 38, mass: 0.9 } as const);
  const fade = { duration: reduceMotion ? 0.01 : 0.2 };

  const position = index >= 0 ? `${index + 1} / ${total}` : `— / ${total}`;
  const category = record ? effCategory(record) : null;
  const time = record ? recordTime(record) : 0;

  return createPortal(
    <AnimatePresence>
      {record && (
        <motion.div
          key="backdrop"
          className="fixed inset-0 z-50 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      {record && (
        <motion.aside
          key="panel"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-[var(--color-border-strong)] bg-[var(--color-bg)] shadow-2xl"
          style={{ outline: "none" }}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={spring}
        >
          <header className="flex flex-wrap items-start gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                tabIndex={-1}
                data-autofocus
                className="font-mono text-lg text-[var(--color-text-primary)]"
                // Not interactive — it only receives focus so a screen reader
                // starts at the top. Inline, because the global :focus-visible
                // rule is unlayered and would beat a Tailwind outline utility.
                style={{ outline: "none" }}
              >
                {record.id}
              </h2>
              <p className="truncate text-sm text-[var(--color-text-secondary)]">
                {category ?? "Uncategorized"}
              </p>
              <time
                dateTime={new Date(time).toISOString()}
                className="font-mono text-xs text-[var(--color-text-muted)]"
              >
                {formatDateTime(time)}
              </time>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="mr-1 font-mono text-xs text-[var(--color-text-secondary)] tabular-nums">
                {position}
              </span>
              <HeaderButton label="Previous record" onClick={onPrev} disabled={index <= 0}>
                <ChevronLeft size={16} aria-hidden="true" />
              </HeaderButton>
              <HeaderButton label="Next record" onClick={onNext} disabled={index < 0 || index >= total - 1}>
                <ChevronRight size={16} aria-hidden="true" />
              </HeaderButton>
              <HeaderButton label="Close" onClick={onClose}>
                <X size={16} aria-hidden="true" />
              </HeaderButton>
            </div>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {`Record ${record.id}, ${position.replace("/", "of")}`}
            </p>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-5">
              <DrawerImage key={record.id} inspection={record} />
              <DrawerSummary inspection={record} threshold={threshold} onClose={onClose} />
              <DrawerTabs inspection={record} threshold={threshold} tab={tab} onTab={setTab} />
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body
  );
}
