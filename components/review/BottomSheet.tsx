"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useDialogFocus } from "@/components/useDialogFocus";

// A bottom sheet with three snap points, for the Review findings on small screens.
//
//   peek  — a handle and a one-line summary; the canvas above is fully usable
//   half  — about half the screen; findings scroll inside
//   full  — everything but the top bar; acts as a modal dialog (focus trapped,
//           Escape steps back down to half, focus returns to the handle)
//
// It is deliberately NOT modal at peek/half: the reviewer draws and adjusts
// boxes on the canvas while reading findings. Drag the handle, or use it with
// the keyboard: Enter / Space cycles, ↑ ↓ step, Home / End jump.

type Snap = "peek" | "half" | "full";
const ORDER: Snap[] = ["peek", "half", "full"];
const LABEL: Record<Snap, string> = { peek: "peeking", half: "half open", full: "fully open" };

export const SHEET_PEEK_PX = 84;
const TOP_GAP_PX = 72; // the top bar (64) plus a little air
const NAV_PX = 60; // the bottom nav — the sheet sits directly above it
const FLICK_PROJECT_MS = 160;
const VELOCITY_STALE_MS = 100; // a pause this long before release = no flick
const MAX_VELOCITY = 3; // px/ms
const TAP_SLOP_PX = 6;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function subscribeResize(cb: () => void) {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
}
const viewportHeight = () => window.innerHeight;
const serverHeight = () => 800;
const viewportWidth = () => window.innerWidth;
const serverWidth = () => 390;

export default function BottomSheet({
  label,
  summary,
  children,
}: {
  label: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const vh = useSyncExternalStore(subscribeResize, viewportHeight, serverHeight);
  const vw = useSyncExternalStore(subscribeResize, viewportWidth, serverWidth);
  // From md up the side nav replaces the bottom nav, so the sheet sits on the floor.
  const navPx = vw >= 768 ? 0 : NAV_PX;
  const reduceMotion = useReducedMotion();
  const [snap, setSnap] = useState<Snap>("peek");

  const heights: Record<Snap, number> = {
    peek: SHEET_PEEK_PX,
    half: Math.round((vh - navPx) * 0.5),
    full: vh - navPx - TOP_GAP_PX,
  };

  const height = useMotionValue(SHEET_PEEK_PX);
  const panelRef = useRef<HTMLElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ startY: number; startH: number; lastY: number; lastT: number; v: number; moved: boolean } | null>(null);
  const swallowClick = useRef(false);
  const uid = useId();
  const handleId = `${uid}-handle`;
  const contentId = `${uid}-content`;

  function goTo(next: Snap) {
    setSnap(next);
    animate(
      height,
      heights[next],
      reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 40, mass: 0.9 }
    );
  }

  // Keep the height right when the viewport changes (rotation, mobile URL bar).
  useEffect(() => {
    height.set(heights[snap]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only on a real viewport change
  }, [vh, vw]);

  // Toasts and page padding elsewhere key off this, so nothing hides behind the peek bar.
  useEffect(() => {
    document.documentElement.style.setProperty("--sheet-peek", `${SHEET_PEEK_PX}px`);
    return () => {
      document.documentElement.style.removeProperty("--sheet-peek");
    };
  }, []);

  // Full = a modal: trap focus, lock page scroll, Escape steps down to half.
  useDialogFocus({ open: snap === "full", panelRef, onClose: () => goTo("half"), fallbackId: handleId });

  // ---- drag ----------------------------------------------------------------

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startH: height.get(), lastY: e.clientY, lastT: e.timeStamp, v: 0, moved: false };
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientY - d.startY) > TAP_SLOP_PX) d.moved = true;
    if (!d.moved) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (d.lastY - e.clientY) / dt; // px/ms, positive = moving up
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    height.set(clamp(d.startH + (d.startY - e.clientY), SHEET_PEEK_PX, heights.full));
  }

  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d?.moved) return; // a tap: the click handler cycles
    swallowClick.current = true; // the click that follows a drag isn't a tap
    // Where it would come to rest if it kept going a moment — so a flick counts.
    // A finger that paused before lifting has no momentum: the last measured
    // velocity only counts if it is fresh, and is capped so nothing can be hurled.
    const fresh = e.timeStamp - d.lastT <= VELOCITY_STALE_MS;
    const v = fresh ? clamp(d.v, -MAX_VELOCITY, MAX_VELOCITY) : 0;
    const projected = height.get() + v * FLICK_PROJECT_MS;
    const target = ORDER.reduce((best, s) => (Math.abs(heights[s] - projected) < Math.abs(heights[best] - projected) ? s : best), "peek" as Snap);
    goTo(target);
  }

  function onClick() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    goTo(ORDER[(ORDER.indexOf(snap) + 1) % ORDER.length]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const i = ORDER.indexOf(snap);
    if (e.key === "ArrowUp") goTo(ORDER[Math.min(ORDER.length - 1, i + 1)]);
    else if (e.key === "ArrowDown") goTo(ORDER[Math.max(0, i - 1)]);
    else if (e.key === "Home") goTo("peek");
    else if (e.key === "End") goTo("full");
    else return;
    e.preventDefault();
  }

  const full = snap === "full";

  return (
    <motion.section
      ref={panelRef}
      role={full ? "dialog" : "region"}
      aria-modal={full ? true : undefined}
      aria-label={label}
      data-snap={snap}
      tabIndex={-1}
      className="fixed inset-x-0 z-30 flex flex-col overflow-hidden md:left-60 rounded-t-[var(--radius-card)] border-t border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_-8px_24px_rgba(0,0,0,0.25)] lg:hidden"
      style={{ bottom: vw >= 768 ? 0 : "var(--bottom-nav-h)", height, outline: "none" }}
    >
      <div className="flex-none border-b border-[var(--color-border)]">
        <button
          ref={handleRef}
          id={handleId}
          type="button"
          aria-controls={contentId}
          aria-expanded={snap !== "peek"}
          aria-label={`${label}, ${LABEL[snap]}. Drag, or press Enter to resize; arrow keys step.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onClick={onClick}
          onKeyDown={onKeyDown}
          className="flex h-11 w-full cursor-grab items-center justify-center active:cursor-grabbing"
          style={{ touchAction: "none" }}
        >
          <span className="h-1.5 w-12 rounded-full bg-[var(--color-border-strong)]" aria-hidden="true" />
        </button>
        <p className="px-4 pb-2 text-xs font-medium text-[var(--color-text-secondary)]">{summary}</p>
      </div>

      {/* At peek the content is clipped away, so it must also leave the tab order. */}
      <div
        id={contentId}
        inert={snap === "peek"}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
      >
        {children}
      </div>
    </motion.section>
  );
}
