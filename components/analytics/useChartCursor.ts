"use client";

import { useState, type KeyboardEvent } from "react";

// The "which period am I looking at" state shared by the trend and volume
// charts: driven by the pointer, and by the keyboard when the chart has focus.
//
//   ← / →   previous / next period      Home / End   first / last
//   Esc     clear
//
// Keyboard moves are announced through `announcement` (render it in an
// aria-live region). Hover is deliberately silent — it would spam a screen
// reader with every pixel of mouse travel.
export function useChartCursor(count: number, describe: (index: number) => string) {
  const [raw, setRaw] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Guards a stale index if the data shrinks (e.g. switching 90d → 7d).
  const active = raw !== null && raw < count ? raw : null;

  function moveTo(index: number) {
    setRaw(index);
    setAnnouncement(describe(index));
  }

  function onKeyDown(e: KeyboardEvent) {
    if (count === 0) return;
    const last = count - 1;
    switch (e.key) {
      case "ArrowRight":
        moveTo(active === null ? last : Math.min(last, active + 1));
        break;
      case "ArrowLeft":
        moveTo(active === null ? last : Math.max(0, active - 1));
        break;
      case "Home":
        moveTo(0);
        break;
      case "End":
        moveTo(last);
        break;
      case "Escape":
        setRaw(null);
        return;
      default:
        return;
    }
    e.preventDefault();
  }

  return {
    active,
    announcement,
    hover: (index: number) => setRaw(index),
    leave: () => setRaw(null),
    // Spread onto the focusable wrapper element.
    containerProps: {
      tabIndex: 0,
      onKeyDown,
      // Landing on the chart shows the most recent period, like a tooltip on the newest point.
      onFocus: () => {
        if (active === null && count > 0) moveTo(count - 1);
      },
      onBlur: () => setRaw(null),
    },
  };
}
