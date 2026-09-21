"use client";

import { useState } from "react";
import { DEFECT_LABEL, SEVERITY_LABEL, type BBox, type Severity } from "@/lib/types";
import { useStore } from "@/lib/store";
import Modal from "./Modal";

export default function DrawPopover({
  inspectionId,
  pendingBox,
  onDone,
}: {
  inspectionId: string;
  pendingBox: BBox | null;
  onDone: () => void;
}) {
  const { dispatch } = useStore();
  const [type, setType] = useState(Object.keys(DEFECT_LABEL)[0]);
  const [severity, setSeverity] = useState<Severity>("low");

  function handleAdd() {
    if (!pendingBox) return;
    dispatch({ type: "DEFECT_ADD", inspectionId, defect: { type, severity, bbox: pendingBox } });
    onDone();
  }

  return (
    <Modal open={pendingBox !== null} onClose={onDone} label="New finding">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">New finding</h2>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">What did you spot in the box you drew?</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
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
            className="h-10 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-text-primary)]"
          >
            {Object.entries(SEVERITY_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--gradient-accent)" }}
        >
          Add
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
}
