"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { BBox } from "@/lib/types";

const MIN_SIZE = 0.02; // 2% — smaller than this reads as an accidental click, not a drag

type Point = { x: number; y: number };

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function rectFrom(a: Point, b: Point): BBox {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

// Sits on top of the frame only while draw mode is on, capturing every
// pointer gesture there — boxes underneath naturally can't be clicked
// through it, so draw and adjust modes never fight over the same gesture.
export default function DrawLayer({
  frameRef,
  onComplete,
}: {
  frameRef: RefObject<HTMLDivElement | null>;
  onComplete: (box: BBox) => void;
}) {
  // Authoritative gesture state lives in a ref — a fast synthetic/automated
  // pointer sequence can fire down/move/up before a render flushes, so the
  // commit on pointerup must not depend on React state having caught up.
  const gestureRef = useRef<{ start: Point; current: Point } | null>(null);
  const [live, setLive] = useState<BBox | null>(null);

  function pointFromEvent(e: ReactPointerEvent<HTMLDivElement>): Point {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height) };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    gestureRef.current = { start: p, current: p };
    setLive(rectFrom(p, p));
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gesture.current = pointFromEvent(e);
    setLive(rectFrom(gesture.start, gesture.current));
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setLive(null);
    if (!gesture) return;
    const box = rectFrom(gesture.start, gesture.current);
    if (box.w >= MIN_SIZE && box.h >= MIN_SIZE) onComplete(box);
  }

  return (
    <div
      className="absolute inset-0 cursor-crosshair touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        gestureRef.current = null;
        setLive(null);
      }}
    >
      {live && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <rect
            x={`${live.x * 100}%`}
            y={`${live.y * 100}%`}
            width={`${live.w * 100}%`}
            height={`${live.h * 100}%`}
            fill="var(--color-accent-cyan)"
            fillOpacity="0.12"
            stroke="var(--color-accent-cyan)"
            strokeWidth="2"
            strokeDasharray="8 6"
            className="marching-ants-rect"
          />
        </svg>
      )}
    </div>
  );
}
