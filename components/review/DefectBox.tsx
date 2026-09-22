"use client";

import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { DEFECT_LABEL, type BBox, type Defect } from "@/lib/types";
import { effBox, effType, isFlagged } from "@/lib/rules";

const MIN_SIZE = 0.02; // 2% — a box can't be dragged/resized smaller than this
const NUDGE_STEP = 0.01;
const NUDGE_STEP_FAST = 0.05;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

type Corner = "nw" | "ne" | "sw" | "se";

function resizeBox(start: BBox, corner: Corner, dx: number, dy: number): BBox {
  let { x, y, w, h } = start;
  if (corner === "nw" || corner === "sw") {
    const nx = clamp(start.x + dx, 0, start.x + start.w - MIN_SIZE);
    w = start.w - (nx - start.x);
    x = nx;
  } else {
    w = clamp(start.w + dx, MIN_SIZE, 1 - start.x);
  }
  if (corner === "nw" || corner === "ne") {
    const ny = clamp(start.y + dy, 0, start.y + start.h - MIN_SIZE);
    h = start.h - (ny - start.y);
    y = ny;
  } else {
    h = clamp(start.h + dy, MIN_SIZE, 1 - start.y);
  }
  return { x, y, w, h };
}

type DragState = {
  kind: "move" | "resize";
  corner?: Corner;
  startClientX: number;
  startClientY: number;
  startBox: BBox;
  frameW: number;
  frameH: number;
  moved: boolean;
  // The authoritative in-progress box. Read from here on commit, not from
  // the `liveBox` React state — synthetic/automated pointer sequences can
  // fire move then up before a render flushes, leaving that state stale.
  liveBox: BBox;
};

const HANDLES: Corner[] = ["nw", "ne", "sw", "se"];
const HANDLE_POS: Record<Corner, { top?: string; bottom?: string; left?: string; right?: string; cursor: string }> = {
  nw: { top: "-5px", left: "-5px", cursor: "nwse-resize" },
  ne: { top: "-5px", right: "-5px", cursor: "nesw-resize" },
  sw: { bottom: "-5px", left: "-5px", cursor: "nesw-resize" },
  se: { bottom: "-5px", right: "-5px", cursor: "nwse-resize" },
};

export default function DefectBox({
  defect,
  threshold,
  showLabel,
  isSelected,
  isHovered,
  adjustable,
  frameRef,
  onSelect,
  onHover,
  onCommitBBox,
}: {
  defect: Defect;
  threshold: number;
  showLabel: boolean;
  isSelected: boolean;
  isHovered: boolean;
  adjustable: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
  onCommitBBox: (bbox: BBox) => void;
}) {
  const dragRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef(false);
  const [liveBox, setLiveBox] = useState<BBox | null>(null);

  const effectiveBox = effBox(defect);
  if (!effectiveBox) return null;
  // Rebound to a definitely-non-null const — closures below capture this,
  // not the BBox | null original, so TS doesn't need to re-narrow across them.
  const storedBox: BBox = effectiveBox;
  const box = liveBox ?? storedBox;

  const flagged = isFlagged(defect, threshold);
  const color = flagged ? "var(--color-review)" : "var(--color-accent-cyan)";
  const type = effType(defect);
  const typeLabel = (type ? (DEFECT_LABEL[type] ?? type) : "Finding").toUpperCase();
  const confidencePct = defect.ai_confidence !== null ? Math.round(defect.ai_confidence * 100) : null;
  const labelBelow = box.y < 0.08;

  function startDrag(e: ReactPointerEvent<HTMLElement>, kind: "move" | "resize", corner?: Corner) {
    if (!adjustable) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      kind,
      corner,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startBox: storedBox,
      frameW: rect.width,
      frameH: rect.height,
      moved: false,
      liveBox: storedBox,
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.startClientX) / drag.frameW;
    const dy = (e.clientY - drag.startClientY) / drag.frameH;
    if (Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002) drag.moved = true;

    const next =
      drag.kind === "move"
        ? {
            ...drag.startBox,
            x: clamp(drag.startBox.x + dx, 0, 1 - drag.startBox.w),
            y: clamp(drag.startBox.y + dy, 0, 1 - drag.startBox.h),
          }
        : drag.corner
          ? resizeBox(drag.startBox, drag.corner, dx, dy)
          : drag.startBox;
    drag.liveBox = next;
    setLiveBox(next);
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    if (drag.moved) {
      // Pointer capture means the click synthesized right after this still
      // targets this element regardless of where the drag ended — mark it
      // so the click handler doesn't treat it as a fresh select toggle.
      justDraggedRef.current = true;
      onCommitBBox(drag.liveBox);
    }
    setLiveBox(null);
  }

  function handleClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      // A drag should leave the box selected, never toggle it off.
      if (!isSelected) onSelect();
      return;
    }
    onSelect();
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!adjustable || !isSelected) return;
    const isArrow = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key);
    if (!isArrow) return;
    e.preventDefault();
    const step = e.shiftKey ? NUDGE_STEP_FAST : NUDGE_STEP;
    const dir = e.key === "ArrowUp" ? [0, -1] : e.key === "ArrowDown" ? [0, 1] : e.key === "ArrowLeft" ? [-1, 0] : [1, 0];

    if (e.altKey) {
      // Alt+Arrow resizes — the only keyboard path to resize (handles are pointer-only).
      const next: BBox = {
        ...storedBox,
        w: clamp(storedBox.w + dir[0] * step, MIN_SIZE, 1 - storedBox.x),
        h: clamp(storedBox.h + dir[1] * step, MIN_SIZE, 1 - storedBox.y),
      };
      onCommitBBox(next);
    } else {
      const next: BBox = {
        ...storedBox,
        x: clamp(storedBox.x + dir[0] * step, 0, 1 - storedBox.w),
        y: clamp(storedBox.y + dir[1] * step, 0, 1 - storedBox.h),
      };
      onCommitBBox(next);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      onPointerDown={(e) => startDrag(e, "move")}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={handleKeyDown}
      aria-label={`${typeLabel}${confidencePct !== null ? `, ${confidencePct}% confidence` : ""}${flagged ? ", needs review" : ""}${adjustable && isSelected ? ". Selected: arrow keys move, shift for larger steps, alt+arrow resizes." : ""}`}
      aria-pressed={isSelected}
      className="absolute rounded-[4px] border-2 transition-[box-shadow,background-color] duration-150"
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.w * 100}%`,
        height: `${box.h * 100}%`,
        borderColor: color,
        background: isSelected || isHovered ? `color-mix(in srgb, ${color} 16%, transparent)` : "transparent",
        boxShadow: isSelected
          ? `0 0 0 2px var(--color-bg), 0 0 0 4px ${color}, 0 0 18px 2px ${color}`
          : isHovered
            ? `0 0 0 3px color-mix(in srgb, ${color} 55%, transparent)`
            : "none",
        cursor: adjustable ? "move" : "pointer",
        touchAction: adjustable ? "none" : undefined,
      }}
    >
      {showLabel && (
        <span
          className="absolute left-0 whitespace-nowrap rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-[var(--color-on-accent)]"
          style={{
            top: labelBelow ? "100%" : undefined,
            bottom: labelBelow ? undefined : "100%",
            marginTop: labelBelow ? "2px" : undefined,
            marginBottom: labelBelow ? undefined : "2px",
            background: color,
          }}
        >
          {typeLabel}
          {confidencePct !== null ? ` ${confidencePct}%` : ""}
        </span>
      )}

      {adjustable &&
        isSelected &&
        HANDLES.map((corner) => (
          <span
            key={corner}
            onPointerDown={(e) => startDrag(e, "resize", corner)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            aria-hidden="true"
            className="absolute h-3 w-3 rounded-full border-2"
            style={{
              ...HANDLE_POS[corner],
              borderColor: color,
              background: "var(--color-bg)",
              touchAction: "none",
            }}
          />
        ))}
    </button>
  );
}
