"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal behaviour shared by every dialog, drawer and sheet in the app:
//  - moves focus in on open ([data-autofocus] first, else the first control)
//  - Escape closes; Tab / Shift+Tab wrap inside the panel
//  - if focus ever lands outside (a click on padding, a screen-reader jump),
//    it is pulled straight back in — so Tab can never reach the page behind
//  - locks page scroll while open
//  - on close, focus returns to the element that opened it (`returnFocusRef`,
//    else whatever was focused at open time), or to `fallbackId` if that
//    element is gone (filtered out, view switched)
//
// Everything is keyed on `open` only. Prev/next swaps the record without
// re-running this, so focus stays on the button the reviewer just pressed.
export function useDialogFocus({
  open,
  panelRef,
  onClose,
  returnFocusRef,
  fallbackId,
}: {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  fallbackId?: string;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;

    const opener =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    // Only what Tab can really reach: `tabIndex >= 0` drops roving-tabindex
    // members (the inactive tabs are focusable by script but skipped by Tab).
    // Counting them made "last" the wrong element, so wrapping never fired.
    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.tabIndex >= 0 && el.getAttribute("aria-hidden") !== "true"
      );

    const initial = panel.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? panel;
    initial.focus({ preventScroll: true });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        panel!.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!panel!.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    function onFocusIn(e: FocusEvent) {
      if (!panel!.contains(e.target as Node)) (focusables()[0] ?? panel!).focus({ preventScroll: true });
    }

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = previousOverflow;

      if (opener && opener !== document.body && opener.isConnected) opener.focus();
      else if (fallbackId) document.getElementById(fallbackId)?.focus();
    };
  }, [open, panelRef, returnFocusRef, fallbackId]);
}
