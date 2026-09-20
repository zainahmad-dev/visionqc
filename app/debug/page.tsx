"use client";

import { useMemo, useState } from "react";
import { StoreProvider, useStore } from "@/lib/store";
import { finalizeBlockers, isFlagged } from "@/lib/rules";

function DebugContent() {
  const { state, dispatch } = useStore();
  const [selectedId, setSelectedId] = useState(state.inspections[0]?.id ?? "");

  const flaggedCount = useMemo(
    () =>
      state.inspections.reduce(
        (count, inspection) =>
          count + inspection.defects.filter((d) => isFlagged(d, state.threshold)).length,
        0
      ),
    [state.inspections, state.threshold]
  );

  const selected = state.inspections.find((i) => i.id === selectedId) ?? state.inspections[0];
  const blockers = selected ? finalizeBlockers(selected, state.threshold) : [];

  return (
    <div className="space-y-6 font-mono text-sm text-[var(--color-text-primary)]">
      <h1 className="font-sans text-2xl font-semibold">Store Debug (Phase 2 scratch page)</h1>

      <section className="space-y-1">
        <p>Total inspections: {state.inspections.length}</p>
        <p>
          Flagged findings at {state.threshold}% threshold: {flaggedCount}
        </p>
      </section>

      <section className="flex items-center gap-3">
        <label htmlFor="threshold">Threshold</label>
        <input
          id="threshold"
          type="range"
          min={50}
          max={99}
          value={state.threshold}
          onChange={(e) => dispatch({ type: "SET_THRESHOLD", value: Number(e.target.value) })}
        />
        <span>{state.threshold}%</span>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <label htmlFor="inspection-select">Chosen inspection</label>
          <select
            id="inspection-select"
            value={selected?.id}
            onChange={(e) => setSelectedId(e.target.value)}
            className="border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
          >
            {state.inspections.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} — {i.status}
              </option>
            ))}
          </select>
        </div>

        {selected && (
          <div className="space-y-2">
            <p>Status: {selected.status}</p>
            <p>Defects: {selected.defects.length}</p>
            <ul className="list-disc space-y-1 pl-5">
              {selected.defects.map((d) => (
                <li key={d.id}>
                  {d.id}: {d.ai_type} ({Math.round((d.ai_confidence ?? 0) * 100)}%) — {d.review}
                  {d.review === "pending" && isFlagged(d, state.threshold) && (
                    <button
                      type="button"
                      className="ml-2 underline"
                      onClick={() =>
                        dispatch({
                          type: "DEFECT_CONFIRM",
                          inspectionId: selected.id,
                          defectId: d.id,
                        })
                      }
                    >
                      confirm
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="border border-[var(--color-border)] px-2 py-1"
                onClick={() =>
                  dispatch({
                    type: "SET_RESULT_MODE",
                    inspectionId: selected.id,
                    mode: selected.result_mode === "override_fail" ? "auto" : "override_fail",
                  })
                }
              >
                Toggle override ({selected.result_mode})
              </button>
              <input
                placeholder="note"
                value={selected.notes}
                onChange={(e) =>
                  dispatch({ type: "SET_NOTES", inspectionId: selected.id, notes: e.target.value })
                }
                className="border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
              />
            </div>

            <p>Blockers: {blockers.length === 0 ? "none" : blockers.join("; ")}</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function DebugPage() {
  return (
    <StoreProvider>
      <DebugContent />
    </StoreProvider>
  );
}
