"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { useStore, type Toast } from "@/lib/store";

const TONE_ICON: Record<Toast["tone"], LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle,
};

const TONE_COLOR: Record<Toast["tone"], string> = {
  info: "var(--color-accent-cyan)",
  success: "var(--color-pass)",
  warning: "var(--color-review)",
  error: "var(--color-fail)",
};

const AUTO_DISMISS_MS = 6000;

export default function ToastHost() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const scheduled = useRef(new Set<string>());
  const hostRef = useRef<HTMLDivElement>(null);
  // Where focus was when each toast appeared (e.g. the Dismiss button that spawned an
  // Undo). Using or dismissing the toast unmounts its buttons, which would drop focus
  // on <body>; this is where it goes back to.
  const origin = useRef(new Map<string, HTMLElement>());

  function focusIsInToasts(): boolean {
    return !!hostRef.current?.contains(document.activeElement);
  }
  function restoreFocus(toastId: string) {
    const previous = origin.current.get(toastId);
    const target = previous && previous.isConnected ? previous : document.getElementById("main");
    window.requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  }

  useEffect(() => {
    const timers: number[] = [];
    for (const toast of state.toasts) {
      if (scheduled.current.has(toast.id)) continue;
      scheduled.current.add(toast.id);
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused !== document.body && !hostRef.current?.contains(focused)) {
        origin.current.set(toast.id, focused);
      }
      timers.push(
        window.setTimeout(() => {
          if (focusIsInToasts()) restoreFocus(toast.id);
          dispatch({ type: "DISMISS_TOAST", id: toast.id });
        }, AUTO_DISMISS_MS)
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [state.toasts, dispatch]);

  function handleAction(toast: Toast) {
    const hadFocus = focusIsInToasts();
    if (toast.action?.focusId) {
      dispatch({ type: "SET_ACTIVE_HUB", id: toast.action.focusId });
    }
    if (toast.action?.onAction) {
      toast.action.onAction();
    } else if (toast.action?.href) {
      router.push(toast.action.href);
    }
    dispatch({ type: "DISMISS_TOAST", id: toast.id });
    if (hadFocus) restoreFocus(toast.id);
  }

  return (
    // Not a live region: the Announcer is the app's one place that speaks these
    // (two regions would read every toast twice).
    <div
      ref={hostRef}
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-h)+var(--sheet-peek,0px)+0.75rem)] z-40 flex flex-col items-center gap-2 px-4 md:inset-x-auto md:right-6 md:bottom-[calc(var(--sheet-peek,0px)+1.5rem)] md:items-end"
    >
      <AnimatePresence initial={false}>
        {state.toasts.map((toast) => {
          const Icon = TONE_ICON[toast.tone];
          const color = TONE_COLOR[toast.tone];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 8, scale: reduceMotion ? 1 : 0.96 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-3 shadow-lg"
            >
              <Icon size={18} style={{ color }} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1 py-0.5">
                <p className="text-sm text-[var(--color-text-primary)]">{toast.message}</p>
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => handleAction(toast)}
                    className="-mb-1 -ml-2 inline-flex min-h-11 min-w-11 items-center justify-center px-2 text-sm font-medium underline-offset-2 hover:underline"
                    style={{ color }}
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => {
                  if (focusIsInToasts()) restoreFocus(toast.id);
                  dispatch({ type: "DISMISS_TOAST", id: toast.id });
                }}
                className="-m-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
