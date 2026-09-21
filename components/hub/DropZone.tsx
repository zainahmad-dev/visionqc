"use client";

import { useRef, useState, type DragEvent } from "react";
import { Camera, UploadCloud } from "lucide-react";

export default function DropZone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const pickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) onFiles(files);
  }

  function handlePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) onFiles(files);
    e.target.value = "";
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Drop images here, or press Enter to browse for files"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => pickerRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pickerRef.current?.click();
        }
      }}
      className="corner-brackets relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-6 py-10 text-center transition-colors hover:border-[var(--color-accent-cyan)]"
      style={{ borderColor: isDragging ? "transparent" : undefined }}
    >
      {isDragging && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <rect
            x="1"
            y="1"
            width="calc(100% - 2px)"
            height="calc(100% - 2px)"
            rx="12"
            fill="none"
            stroke="var(--color-accent-cyan)"
            strokeWidth="2"
            strokeDasharray="8 6"
            className="marching-ants-rect"
          />
        </svg>
      )}

      <span
        className="flex h-12 w-12 items-center justify-center rounded-full text-white"
        style={{ background: "var(--gradient-accent)" }}
      >
        <UploadCloud size={22} strokeWidth={2} />
      </span>

      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Drag & drop product photos, or click to browse
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">JPG, PNG, WEBP — one scan at a time</p>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          cameraRef.current?.click();
        }}
        className="relative z-10 mt-1 flex h-11 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
      >
        <Camera size={16} />
        Capture with Camera
      </button>

      <input
        ref={pickerRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={handlePicked}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={handlePicked}
      />
    </div>
  );
}
