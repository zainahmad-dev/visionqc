"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Inspection } from "@/lib/types";
import { nextInspectionIds } from "@/lib/ids";
import DropZone from "@/components/hub/DropZone";
import HeaderChips from "@/components/hub/HeaderChips";
import QueueList from "@/components/hub/QueueList";
import PreviewPanel from "@/components/hub/PreviewPanel";

export default function HubPage() {
  const { state, dispatch } = useStore();
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const hubItems = useMemo(
    () =>
      [...state.inspections]
        .filter((i) => i.status !== "completed")
        .sort((a, b) => b.created_at - a.created_at),
    [state.inspections]
  );

  const active = useMemo(() => {
    if (state.activeHubId) {
      const found = hubItems.find((i) => i.id === state.activeHubId);
      if (found) return found;
    }
    return hubItems[0] ?? null;
  }, [state.activeHubId, hubItems]);

  function handleFiles(files: File[]) {
    const ids = nextInspectionIds(state.inspections, files.length);
    const now = Date.now();
    const newInspections: Inspection[] = files.map((file, index) => ({
      id: ids[index],
      created_at: now + index,
      status: "queued",
      category: null,
      category_confidence: null,
      ai_recommendation: null,
      raw_output: null,
      error_code: null,
      file_name: file.name,
      image_url: URL.createObjectURL(file),
      defects: [],
      reviewer_category: null,
      result_mode: "auto",
      notes: "",
      reviewed_at: null,
    }));

    dispatch({ type: "ADD_QUEUE_MANY", inspections: newInspections });
    dispatch({ type: "SET_ACTIVE_HUB", id: newInspections[0].id });
  }

  function handleRemoveMany(ids: string[]) {
    for (const id of ids) {
      const inspection = state.inspections.find((i) => i.id === id);
      if (inspection?.image_url.startsWith("blob:")) URL.revokeObjectURL(inspection.image_url);
      dispatch({ type: "REMOVE_QUEUE", id });
    }
    setChecked((prev) => {
      if (ids.every((id) => !prev.has(id))) return prev;
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Live Hub</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Real-time queue of inspections as they arrive and get scanned.
        </p>
      </div>

      <HeaderChips items={hubItems} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <DropZone onFiles={handleFiles} />

          {checked.size > 0 && (
            <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
              <span className="text-[var(--color-text-secondary)]">{checked.size} selected</span>
              <button
                type="button"
                onClick={() => handleRemoveMany([...checked])}
                className="flex h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-xs font-medium text-[var(--color-fail)] transition-colors hover:bg-[var(--color-fail)]/10"
              >
                <Trash2 size={13} />
                Remove selected
              </button>
            </div>
          )}

          <QueueList
            items={hubItems}
            activeId={active?.id ?? null}
            checked={checked}
            onSelect={(id) => dispatch({ type: "SET_ACTIVE_HUB", id })}
            onToggleCheck={toggleCheck}
            onRemove={(id) => handleRemoveMany([id])}
          />

          <details className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center select-none text-[var(--color-text-secondary)]">
              Developer options
            </summary>
            <label className="flex min-h-11 items-center gap-2 text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={state.simulateInvalidJson}
                onChange={(e) =>
                  dispatch({ type: "SET_SIMULATE_INVALID_JSON", value: e.target.checked })
                }
                className="h-4 w-4 accent-[var(--color-accent-cyan)]"
              />
              Simulate invalid JSON on the next scan
            </label>
          </details>
        </div>

        <div className="lg:sticky lg:top-20 lg:self-start">
          <PreviewPanel inspection={active} scan={state.scan} />
        </div>
      </div>
    </div>
  );
}
