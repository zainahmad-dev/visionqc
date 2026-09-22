"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORIES } from "@/lib/mock";
import { useStore } from "@/lib/store";
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  FIRST_DIR,
  NO_CATEGORY,
  effCategory,
  filtersFromParams,
  finalFindings,
  hasActiveFilters,
  isLogRecord,
  matchesFilters,
  sortRecords,
  type LogFilters,
  type SortKey,
  type SortState,
} from "@/lib/logs";
import { effType } from "@/lib/rules";
import EmptyState from "@/components/logs/EmptyState";
import FilterBar, { defectTypeOptions } from "@/components/logs/FilterBar";
import LogsGrid from "@/components/logs/LogsGrid";
import LogsSkeleton from "@/components/logs/LogsSkeleton";
import LogsTable from "@/components/logs/LogsTable";
import RecordDrawer from "@/components/logs/RecordDrawer";
import ViewToggle, { type View } from "@/components/logs/ViewToggle";
import { useInitialLoad } from "@/components/logs/useInitialLoad";

const HIGHLIGHT_MS = 5000;

function LogsPageInner() {
  const { state } = useStore();
  const searchParams = useSearchParams();
  const highlightParam = searchParams.get("highlight");

  const loaded = useInitialLoad();
  // Starts from the URL so a link can arrive pre-filtered (Analytics → Needs review).
  const [filters, setFilters] = useState<LogFilters>(() => filtersFromParams(searchParams));
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [view, setView] = useState<View>("table");
  const [openId, setOpenId] = useState<string | null>(null);
  // The control that opened the drawer — focus goes back to it on close.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // ---- data ---------------------------------------------------------------

  const records = useMemo(() => state.inspections.filter(isLogRecord), [state.inspections]);

  // Filtered THEN sorted — and this same list drives the drawer's prev/next.
  const visible = useMemo(
    () =>
      sortRecords(
        records.filter((r) => matchesFilters(r, filters)),
        sort
      ),
    [records, filters, sort]
  );

  const categoryOptions = useMemo(() => {
    const present = records.map(effCategory);
    const names = Array.from(new Set([...CATEGORIES, ...present.filter((c): c is string => c !== null)]));
    const options = names.map((value) => ({ value, label: value }));
    return present.includes(null) ? [...options, { value: NO_CATEGORY, label: "Uncategorized" }] : options;
  }, [records]);

  const defectOptions = useMemo(
    () =>
      defectTypeOptions(
        records.flatMap((r) => finalFindings(r).map(effType).filter((t): t is string => t !== null))
      ),
    [records]
  );

  // ---- highlight (a freshly finalized record) -----------------------------

  // Shown for a few seconds, counted from when the data is actually on screen.
  // `expiredId` remembers which id has run out, so the timer only ever sets
  // state from its callback — never synchronously inside the effect.
  const [expiredId, setExpiredId] = useState<string | null>(null);
  useEffect(() => {
    if (!loaded || !highlightParam) return;
    const timer = window.setTimeout(() => setExpiredId(highlightParam), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [loaded, highlightParam]);

  const highlightId =
    loaded && highlightParam && highlightParam !== expiredId && records.some((r) => r.id === highlightParam)
      ? highlightParam
      : null;

  // ---- drawer -------------------------------------------------------------

  const openIndex = openId ? visible.findIndex((r) => r.id === openId) : -1;
  const openRecord = openId ? (visible[openIndex] ?? records.find((r) => r.id === openId) ?? null) : null;

  function handleOpen(id: string, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setOpenId(id);
  }

  function handleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: FIRST_DIR[key] }));
  }

  const clearAll = () => setFilters(EMPTY_FILTERS);

  // ---- render -------------------------------------------------------------

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Logs</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Full history of every inspection, its status, and how it was resolved.
        </p>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onClearAll={clearAll}
        categoryOptions={categoryOptions}
        defectOptions={defectOptions}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" className="text-sm text-[var(--color-text-secondary)]">
          {loaded ? (
            <>
              <span className="font-mono text-[var(--color-text-primary)]">{visible.length}</span> of{" "}
              <span className="font-mono text-[var(--color-text-primary)]">{records.length}</span> records
            </>
          ) : (
            "Loading records…"
          )}
        </p>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {!loaded ? (
        <LogsSkeleton view={view} />
      ) : visible.length === 0 ? (
        <EmptyState filtered={hasActiveFilters(filters)} onClear={clearAll} />
      ) : view === "table" ? (
        <LogsTable
          records={visible}
          sort={sort}
          onSort={handleSort}
          threshold={state.threshold}
          highlightId={highlightId}
          onOpen={handleOpen}
        />
      ) : (
        <LogsGrid records={visible} threshold={state.threshold} highlightId={highlightId} onOpen={handleOpen} />
      )}

      <RecordDrawer
        record={openRecord}
        index={openIndex}
        total={visible.length}
        threshold={state.threshold}
        returnFocusRef={returnFocusRef}
        onPrev={() => openIndex > 0 && setOpenId(visible[openIndex - 1].id)}
        onNext={() => openIndex >= 0 && openIndex < visible.length - 1 && setOpenId(visible[openIndex + 1].id)}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

// useSearchParams needs a Suspense boundary for the production build.
export default function LogsPage() {
  return (
    <Suspense fallback={null}>
      <LogsPageInner />
    </Suspense>
  );
}
