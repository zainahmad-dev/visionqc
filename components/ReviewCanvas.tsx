"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { FilePlus2, ImageOff, Maximize2, PenLine, Square, Tag, ZoomIn, ZoomOut } from "lucide-react";
import type { BBox, Defect, Inspection } from "@/lib/types";
import { effBox } from "@/lib/rules";
import { useStore } from "@/lib/store";
import DefectBox from "./review/DefectBox";
import DrawLayer from "./review/DrawLayer";
import DrawPopover from "./review/DrawPopover";
import AddDefectDialog from "./review/AddDefectDialog";

// ---------------------------------------------------------------------------
// Image asset — decodes the blob to get real dimensions, byte size and mime
// type. A failed fetch/decode is also how the "image unreadable" state is
// detected, so this hook is the single source of truth for both.
// ---------------------------------------------------------------------------

type AssetState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; src: string; width: number; height: number; bytes: number; format: string };

function formatFromMime(mime: string): string | null {
  const sub = mime.split("/")[1];
  if (!sub) return null;
  const upper = sub.toUpperCase();
  return upper === "JPEG" || upper === "JPG" ? "JPEG" : upper;
}

function formatFromName(url: string): string {
  const clean = url.split(/[?#]/)[0];
  const ext = clean.split(".").pop()?.toUpperCase();
  if (!ext || ext === clean.toUpperCase()) return "—";
  return ext === "JPG" ? "JPEG" : ext;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function useImageAsset(url: string): AssetState {
  // Keyed by the url it was produced for, so a still-in-flight result from a
  // previous url can be told apart from the current one during render —
  // rather than resetting to "loading" with a synchronous setState in effect.
  const [result, setResult] = useState<{ url: string; state: AssetState }>(() => ({
    url,
    state: { status: "loading" },
  }));

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const src = URL.createObjectURL(blob);
        createdUrl = src;
        const img = new window.Image();
        img.onload = () => {
          if (cancelled) return;
          setResult({
            url,
            state: {
              status: "ready",
              src,
              width: img.naturalWidth,
              height: img.naturalHeight,
              bytes: blob.size,
              format: formatFromMime(blob.type) ?? formatFromName(url),
            },
          });
        };
        img.onerror = () => {
          if (!cancelled) setResult({ url, state: { status: "error" } });
        };
        img.src = src;
      })
      .catch(() => {
        if (!cancelled) setResult({ url, state: { status: "error" } });
      });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [url]);

  return result.url === url ? result.state : { status: "loading" };
}

// ---------------------------------------------------------------------------
// Fit math — the frame is sized to the image's own aspect ratio and centered
// in the viewport, so overlay percentages map 1:1 onto its rendered box no
// matter how the window is resized.
// ---------------------------------------------------------------------------

function useElementSize(): [RefObject<HTMLDivElement | null>, { width: number; height: number }] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
}

const ZOOM_MIN = 25;
const ZOOM_MAX = 300;
const ZOOM_STEP = 25;

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-label={label}
      aria-pressed={active}
      aria-disabled={disabled}
      title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border transition-colors"
      style={{
        borderColor: active ? "var(--color-accent-cyan)" : "var(--color-border)",
        color: disabled ? "var(--color-text-muted)" : active ? "var(--color-accent-cyan)" : "var(--color-text-secondary)",
        background: active ? "color-mix(in srgb, var(--color-accent-cyan) 14%, transparent)" : "transparent",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Toolbar({
  zoom,
  onZoomOut,
  onZoomIn,
  onFit,
  showBoxes,
  onToggleBoxes,
  showLabels,
  onToggleLabels,
  drawMode,
  onToggleDraw,
  drawDisabled,
  onOpenAddDialog,
}: {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
  showBoxes: boolean;
  onToggleBoxes: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  drawMode: boolean;
  onToggleDraw: () => void;
  drawDisabled: boolean;
  onOpenAddDialog: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <ToolbarButton label="Zoom out" onClick={onZoomOut}>
          <ZoomOut size={15} />
        </ToolbarButton>
        <span className="w-14 text-center font-mono text-xs text-[var(--color-text-secondary)]">{zoom}%</span>
        <ToolbarButton label="Zoom in" onClick={onZoomIn}>
          <ZoomIn size={15} />
        </ToolbarButton>
        <ToolbarButton label="Fit to view" onClick={onFit}>
          <Maximize2 size={15} />
        </ToolbarButton>
      </div>
      <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <ToolbarButton label="Toggle bounding boxes" active={showBoxes} onClick={onToggleBoxes}>
          <Square size={15} />
        </ToolbarButton>
        <ToolbarButton label="Toggle labels" active={showLabels} onClick={onToggleLabels}>
          <Tag size={15} />
        </ToolbarButton>
      </div>
      <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
        <ToolbarButton
          label={drawDisabled ? "Draw new finding (needs a displayed image)" : "Draw new finding"}
          active={drawMode}
          disabled={drawDisabled}
          onClick={onToggleDraw}
        >
          <PenLine size={15} />
        </ToolbarButton>
        <ToolbarButton label="Add finding via form" onClick={onOpenAddDialog}>
          <FilePlus2 size={15} />
        </ToolbarButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Footer strip
// ---------------------------------------------------------------------------

function FooterStat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="text-[var(--color-text-muted)]">{label} </span>
      <span className="text-[var(--color-text-primary)]">{value}</span>
    </span>
  );
}

function FooterStrip({
  asset,
  cursorFraction,
  selectedDefect,
}: {
  asset: AssetState;
  cursorFraction: { x: number; y: number } | null;
  selectedDefect: Defect | null;
}) {
  const dims = asset.status === "ready" ? `${asset.width} × ${asset.height}px` : "—";
  const size = asset.status === "ready" ? formatBytes(asset.bytes) : "—";
  const format = asset.status === "ready" ? asset.format : "—";
  const cursor = cursorFraction ? `${cursorFraction.x.toFixed(3)}, ${cursorFraction.y.toFixed(3)}` : "—";
  const box = selectedDefect ? effBox(selectedDefect) : null;
  const boxStr = box
    ? `x ${(box.x * 100).toFixed(1)}% · y ${(box.y * 100).toFixed(1)}% · w ${(box.w * 100).toFixed(1)}% · h ${(box.h * 100).toFixed(1)}%`
    : "—";

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[11px]">
      <FooterStat label="Dimensions:" value={dims} />
      <FooterStat label="Size:" value={size} />
      <FooterStat label="Format:" value={format} />
      <FooterStat label="Cursor:" value={cursor} />
      <FooterStat label="Selection:" value={boxStr} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

export default function ReviewCanvas({
  inspection,
  threshold,
  selectedDefectId,
  hoveredDefectId,
  onSelectDefect,
  onHoverDefect,
}: {
  inspection: Inspection;
  threshold: number;
  selectedDefectId: string | null;
  hoveredDefectId: string | null;
  onSelectDefect: (id: string | null) => void;
  onHoverDefect: (id: string | null) => void;
}) {
  const { dispatch } = useStore();
  const asset = useImageAsset(inspection.image_url);
  const [viewportRef, viewportSize] = useElementSize();
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [cursorFraction, setCursorFraction] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<"select" | "draw">("select");
  const [pendingBox, setPendingBox] = useState<BBox | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Callers key this component by inspection.id, so a record switch remounts
  // it fresh — no effect needed to reset zoom/cursor state.
  const frame = useMemo(() => {
    if (asset.status !== "ready" || viewportSize.width === 0 || viewportSize.height === 0) return null;
    const containerRatio = viewportSize.width / viewportSize.height;
    const imgRatio = asset.width / asset.height;
    const fit =
      imgRatio > containerRatio
        ? { width: viewportSize.width, height: viewportSize.width / imgRatio }
        : { width: viewportSize.height * imgRatio, height: viewportSize.height };
    const scale = zoom / 100;
    return { width: fit.width * scale, height: fit.height * scale };
  }, [asset, viewportSize, zoom]);

  const selectedDefect = inspection.defects.find((d) => d.id === selectedDefectId) ?? null;

  function commitBBox(defectId: string, bbox: BBox) {
    dispatch({ type: "DEFECT_EDIT", inspectionId: inspection.id, defectId, edits: { bbox } });
  }

  return (
    <div className="flex flex-col gap-3">
      <Toolbar
        zoom={zoom}
        onZoomOut={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
        onZoomIn={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
        onFit={() => setZoom(100)}
        showBoxes={showBoxes}
        onToggleBoxes={() => setShowBoxes((v) => !v)}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        drawMode={mode === "draw"}
        onToggleDraw={() => setMode((m) => (m === "draw" ? "select" : "draw"))}
        drawDisabled={!frame}
        onOpenAddDialog={() => setAddDialogOpen(true)}
      />

      <div
        ref={viewportRef}
        className={`corner-brackets relative flex items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] ${
          asset.status === "ready" ? "overflow-auto" : "overflow-hidden"
        }`}
        style={{ height: "clamp(360px, 55vh, 640px)" }}
      >
        {asset.status === "error" && (
          <div className="flex max-w-xs flex-col items-center gap-2 p-6 text-center">
            <ImageOff size={28} className="text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              This image cannot be displayed. Use &quot;Add finding via form&quot; above to record findings
              manually.
            </p>
          </div>
        )}

        {asset.status === "loading" && (
          <div className="h-2/3 w-2/3 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-border)]" />
        )}

        {asset.status === "ready" && frame && (
          <div
            ref={frameRef}
            className="relative shrink-0"
            style={{ width: frame.width, height: frame.height }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setCursorFraction({
                x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
                y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
              });
            }}
            onMouseLeave={() => setCursorFraction(null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- decoded blob, sized to its own aspect ratio */}
            <img
              src={asset.src}
              alt={`${inspection.file_name} — inspection stage`}
              className="pointer-events-none h-full w-full select-none"
              draggable={false}
            />

            {showBoxes &&
              inspection.defects.map((defect) => (
                <DefectBox
                  key={defect.id}
                  defect={defect}
                  threshold={threshold}
                  showLabel={showLabels}
                  isSelected={defect.id === selectedDefectId}
                  isHovered={defect.id === hoveredDefectId}
                  adjustable={mode === "select"}
                  frameRef={frameRef}
                  onSelect={() => onSelectDefect(defect.id === selectedDefectId ? null : defect.id)}
                  onHover={(hovering) => onHoverDefect(hovering ? defect.id : null)}
                  onCommitBBox={(bbox) => commitBBox(defect.id, bbox)}
                />
              ))}

            {mode === "draw" && <DrawLayer frameRef={frameRef} onComplete={setPendingBox} />}
          </div>
        )}
      </div>

      <FooterStrip asset={asset} cursorFraction={cursorFraction} selectedDefect={selectedDefect} />

      <DrawPopover inspectionId={inspection.id} pendingBox={pendingBox} onDone={() => setPendingBox(null)} />
      <AddDefectDialog
        inspectionId={inspection.id}
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
      />
    </div>
  );
}
