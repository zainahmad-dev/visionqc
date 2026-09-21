"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ImageOff, Maximize2, Square, Tag, ZoomIn, ZoomOut } from "lucide-react";
import { DEFECT_LABEL, type Defect, type Inspection } from "@/lib/types";
import { effBox, effType, isFlagged } from "@/lib/rules";

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
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] border transition-colors"
      style={{
        borderColor: active ? "var(--color-accent-cyan)" : "var(--color-border)",
        color: active ? "var(--color-accent-cyan)" : "var(--color-text-secondary)",
        background: active ? "color-mix(in srgb, var(--color-accent-cyan) 14%, transparent)" : "transparent",
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
}: {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
  showBoxes: boolean;
  onToggleBoxes: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Defect overlay box
// ---------------------------------------------------------------------------

function DefectBox({
  defect,
  threshold,
  showLabel,
  isSelected,
  isHovered,
  onSelect,
  onHover,
}: {
  defect: Defect;
  threshold: number;
  showLabel: boolean;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovering: boolean) => void;
}) {
  const box = effBox(defect);
  if (!box) return null;

  const flagged = isFlagged(defect, threshold);
  const color = flagged ? "var(--color-review)" : "var(--color-accent-cyan)";
  const type = effType(defect);
  const typeLabel = (type ? (DEFECT_LABEL[type] ?? type) : "Finding").toUpperCase();
  const confidencePct = defect.ai_confidence !== null ? Math.round(defect.ai_confidence * 100) : null;
  const labelBelow = box.y < 0.08;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      aria-label={`${typeLabel}${confidencePct !== null ? `, ${confidencePct}% confidence` : ""}${flagged ? ", needs review" : ""}`}
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
      }}
    >
      {showLabel && (
        <span
          className="absolute left-0 whitespace-nowrap rounded-[3px] px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-[#0b0f17]"
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
    </button>
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
  const asset = useImageAsset(inspection.image_url);
  const [viewportRef, viewportSize] = useElementSize();
  const [zoom, setZoom] = useState(100);
  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [cursorFraction, setCursorFraction] = useState<{ x: number; y: number } | null>(null);

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
              This image cannot be displayed. Findings can still be recorded manually.
            </p>
          </div>
        )}

        {asset.status === "loading" && (
          <div className="h-2/3 w-2/3 animate-pulse rounded-[var(--radius-card)] bg-[var(--color-border)]" />
        )}

        {asset.status === "ready" && frame && (
          <div
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
                  onSelect={() => onSelectDefect(defect.id === selectedDefectId ? null : defect.id)}
                  onHover={(hovering) => onHoverDefect(hovering ? defect.id : null)}
                />
              ))}
          </div>
        )}
      </div>

      <FooterStrip asset={asset} cursorFraction={cursorFraction} selectedDefect={selectedDefect} />
    </div>
  );
}
