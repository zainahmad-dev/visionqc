"use client";

import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDialogFocus } from "@/components/useDialogFocus";

// document.body only exists client-side — this is the React-sanctioned way
// to read that external fact without a synchronous setState-in-effect.
function subscribeNever() {
  return () => {};
}
function isClient() {
  return true;
}
function isServer() {
  return false;
}

// Portaled to document.body — PageTransition wraps every page in a
// motion.div with a `transform`, which would otherwise confine a
// position:fixed backdrop to that box instead of the real viewport.
//
// Focus handling (move in, wrap Tab, Escape, pull back stray focus, restore on
// close) is the shared hook every dialog, drawer and sheet uses.
export default function Modal({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const mounted = useSyncExternalStore(subscribeNever, isClient, isServer);
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus({ open: open && mounted, panelRef: dialogRef, onClose });

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-5 shadow-lg"
        style={{ outline: "none" }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
