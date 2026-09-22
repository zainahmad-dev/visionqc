"use client";

import { useState } from "react";
import { DEFECT_LABEL, SEVERITY_LABEL, type Severity } from "@/lib/types";
import { useStore } from "@/lib/store";
import Modal from "./Modal";

const FIELDS = [
  { key: "x", label: "X" },
  { key: "y", label: "Y" },
  { key: "w", label: "Width" },
  { key: "h", label: "Height" },
] as const;

type PctBox = { x: number; y: number; w: number; h: number };
const DEFAULT_BOX: PctBox = { x: 10, y: 10, w: 20, h: 20 };

export default function AddDefectDialog({
  inspectionId,
  open,
  onClose,
}: {
  inspectionId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const [type, setType] = useState(Object.keys(DEFECT_LABEL)[0]);
  const [severity, setSeverity] = useState<Severity>("low");
  const [pct, setPct] = useState<PctBox>(DEFAULT_BOX);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setPct(DEFAULT_BOX);
    setError(null);
    onClose();
  }

  function handleAdd() {
    const { x, y, w, h } = pct;
    if (!(w > 0) || !(h > 0)) {
      setError("Width and height must be greater than 0%.");
      return;
    }
    if (x < 0 || y < 0 || x + w > 100 || y + h > 100) {
      setError("The box must stay within the image — x + width and y + height can't exceed 100%.");
      return;
    }
    dispatch({
      type: "DEFECT_ADD",
      inspectionId,
      defect: { type, severity, bbox: { x: x / 100, y: y / 100, w: w / 100, h: h / 100 } },
    });
    handleClose();
  }

  return (
    <Modal open={open} onClose={handleClose} label="Add finding via form">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Add finding via form</h2>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        Enter the box as percentages of the image — for keyboard-only review, or when the image can&apos;t be
        displayed.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-11 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
          >
            {Object.entries(DEFECT_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
            className="h-11 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
          >
            {Object.entries(SEVERITY_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
            {f.label} %
            <input
              type="number"
              min={0}
              max={100}
              value={pct[f.key]}
              onChange={(e) => setPct((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
              className="h-11 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
            />
          </label>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-[var(--color-fail)]">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--gradient-accent-strong)" }}
        >
          Add
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
