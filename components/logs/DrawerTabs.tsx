"use client";

import { useId, type KeyboardEvent } from "react";
import type { Inspection } from "@/lib/types";
import FindingsTab from "./FindingsTab";
import RawJsonTab from "./RawJsonTab";
import TimelineTab from "./TimelineTab";

export type TabId = "findings" | "raw" | "timeline";

const TABS: { id: TabId; label: string }[] = [
  { id: "findings", label: "Findings" },
  { id: "raw", label: "Raw JSON" },
  { id: "timeline", label: "Timeline" },
];

// WAI-ARIA tabs: one tab stop (roving tabindex), arrows / Home / End move.
export default function DrawerTabs({
  inspection,
  threshold,
  tab,
  onTab,
}: {
  inspection: Inspection;
  threshold: number;
  tab: TabId;
  onTab: (tab: TabId) => void;
}) {
  const baseId = useId();

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((t) => t.id === tab);
    let next = current;
    if (e.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;

    e.preventDefault();
    onTab(TABS[next].id);
    document.getElementById(`${baseId}-tab-${TABS[next].id}`)?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Record details"
        onKeyDown={handleKeyDown}
        className="flex gap-1 border-b border-[var(--color-border)]"
      >
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              id={`${baseId}-tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onTab(t.id)}
              className="-mb-px flex h-11 items-center border-b-2 px-4 text-sm font-medium transition-colors"
              style={{
                borderBottomColor: selected ? "var(--color-accent-cyan)" : "transparent",
                color: selected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${tab}`}
        aria-labelledby={`${baseId}-tab-${tab}`}
      >
        {tab === "findings" && <FindingsTab inspection={inspection} threshold={threshold} />}
        {tab === "raw" && <RawJsonTab inspection={inspection} />}
        {tab === "timeline" && <TimelineTab inspection={inspection} />}
      </div>
    </div>
  );
}
