"use client";

import { createContext, useContext, useEffect, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import type { BBox, Defect, ErrorCode, Inspection, ResultMode, Severity } from "./types";
import type { ScanPhase } from "./scan";

export type Tab = "hub" | "review" | "logs" | "analytics";

// Either navigates (href) or runs a local callback (onAction) — e.g. an
// "Undo" after dismissing a finding, which shouldn't change the route.
export type ToastAction = { label: string; href?: string; focusId?: string; onAction?: () => void };

export type Toast = {
  id: string;
  message: string;
  tone: "info" | "success" | "warning" | "error";
  action?: ToastAction;
};

// The one scan the simulated engine is actively working on — null when idle.
export type ScanState = {
  inspectionId: string;
  phase: ScanPhase;
  phaseStartedAt: number;
  scanStartedAt: number;
  simulateInvalidJson: boolean;
} | null;

// A superseded scan attempt, kept when Retry starts a new one — CLAUDE.md rule
// 3 ("nothing is discarded") applies to retries too, not just the current
// attempt. Session-only: like everything else before Finalize, it's gone on
// refresh, and a finalized record only ever carries its one final raw_output.
export type ScanAttempt = { raw_output: string | null; error_code: ErrorCode | null; at: number };
export type ScanMeta = { retryCount: number; history: ScanAttempt[] };

export type State = {
  inspections: Inspection[];
  threshold: number; // percent, 0-100
  activeTab: Tab;
  theme: "dark" | "light";
  toasts: Toast[];
  scan: ScanState;
  simulateInvalidJson: boolean; // dev toggle, consumed by the next scan that starts
  activeHubId: string | null; // inspection focused in the Hub preview panel
  scanMeta: Record<string, ScanMeta>; // keyed by inspection id
  // A spoken-only message for the screen-reader live region (e.g. "restored" after
  // Undo) — things that happen without a visible toast.
  announcement: { id: string; message: string } | null;
};

export type Action =
  | { type: "ADD_QUEUE_MANY"; inspections: Inspection[] }
  | { type: "REMOVE_QUEUE"; id: string }
  | { type: "SCAN_START"; id: string }
  | { type: "SCAN_PHASE"; id: string; phase: ScanPhase }
  | { type: "SCAN_DONE"; id: string; result: Partial<Inspection> }
  | { type: "RETRY"; id: string }
  | { type: "SET_SIMULATE_INVALID_JSON"; value: boolean }
  | { type: "SET_ACTIVE_HUB"; id: string | null }
  | { type: "SET_THRESHOLD"; value: number }
  | { type: "DEFECT_CONFIRM"; inspectionId: string; defectId: string }
  | {
      type: "DEFECT_EDIT";
      inspectionId: string;
      defectId: string;
      edits: { type?: string; severity?: Severity; bbox?: BBox };
    }
  | { type: "DEFECT_DISMISS"; inspectionId: string; defectId: string }
  | { type: "DEFECT_RESTORE"; inspectionId: string; defectId: string }
  | {
      type: "DEFECT_ADD";
      inspectionId: string;
      defect: { type: string; severity: Severity; bbox: BBox };
    }
  | { type: "SET_RESULT_MODE"; inspectionId: string; mode: ResultMode }
  | { type: "SET_REVIEWER_CATEGORY"; inspectionId: string; category: string }
  | { type: "SET_NOTES"; inspectionId: string; notes: string }
  // Fired once the server action has actually committed the row (and the
  // image) to Supabase — `inspection` is what it wrote, so the client's copy
  // converges exactly onto the saved one (real image_url, server reviewed_at).
  | { type: "FINALIZE_SAVED"; inspection: Inspection }
  | { type: "SET_TAB"; tab: Tab }
  | { type: "TOAST"; message: string; tone?: Toast["tone"]; action?: ToastAction }
  | { type: "ANNOUNCE"; message: string }
  | { type: "DISMISS_TOAST"; id: string }
  | { type: "TOGGLE_THEME" };

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapInspection(
  inspections: Inspection[],
  id: string,
  fn: (inspection: Inspection) => Inspection
): Inspection[] {
  return inspections.map((inspection) => (inspection.id === id ? fn(inspection) : inspection));
}

function mapDefect(
  inspection: Inspection,
  defectId: string,
  fn: (defect: Defect) => Defect
): Inspection {
  return {
    ...inspection,
    defects: inspection.defects.map((defect) => (defect.id === defectId ? fn(defect) : defect)),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ADD_QUEUE_MANY":
      return { ...state, inspections: [...action.inspections, ...state.inspections] };

    case "REMOVE_QUEUE": {
      const restMeta = Object.fromEntries(Object.entries(state.scanMeta).filter(([id]) => id !== action.id));
      return {
        ...state,
        inspections: state.inspections.filter((i) => i.id !== action.id),
        scan: state.scan?.inspectionId === action.id ? null : state.scan,
        activeHubId: state.activeHubId === action.id ? null : state.activeHubId,
        scanMeta: restMeta,
      };
    }

    case "SCAN_START": {
      const now = Date.now();
      return {
        ...state,
        simulateInvalidJson: false, // consumed by this scan
        scan: {
          inspectionId: action.id,
          phase: "ingesting",
          phaseStartedAt: now,
          scanStartedAt: now,
          simulateInvalidJson: state.simulateInvalidJson,
        },
        inspections: mapInspection(state.inspections, action.id, (i) => ({
          ...i,
          status: "scanning",
        })),
      };
    }

    case "SCAN_PHASE": {
      if (!state.scan || state.scan.inspectionId !== action.id) return state;
      return { ...state, scan: { ...state.scan, phase: action.phase, phaseStartedAt: Date.now() } };
    }

    case "SCAN_DONE":
      return {
        ...state,
        scan: state.scan?.inspectionId === action.id ? null : state.scan,
        inspections: mapInspection(state.inspections, action.id, (i) => {
          const merged: Inspection = { ...i, ...action.result };
          merged.status = merged.error_code
            ? merged.error_code === "timeout"
              ? "failed"
              : "needs_manual_review"
            : "analyzed";
          return merged;
        }),
      };

    case "RETRY": {
      // Re-queue rather than jump straight to "scanning" — the engine already
      // owns picking one queued item at a time, so retries flow through it too.
      const current = state.inspections.find((i) => i.id === action.id);
      const meta = state.scanMeta[action.id] ?? { retryCount: 0, history: [] };
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.id, (i) => ({
          ...i,
          status: "queued",
          error_code: null,
        })),
        // The attempt being superseded goes into history before it's overwritten —
        // never discarded, just no longer the one shown by default.
        scanMeta: {
          ...state.scanMeta,
          [action.id]: {
            retryCount: meta.retryCount + 1,
            history: current
              ? [...meta.history, { raw_output: current.raw_output, error_code: current.error_code, at: Date.now() }]
              : meta.history,
          },
        },
      };
    }

    case "SET_SIMULATE_INVALID_JSON":
      return { ...state, simulateInvalidJson: action.value };

    case "SET_ACTIVE_HUB":
      return { ...state, activeHubId: action.id };

    case "SET_THRESHOLD":
      return { ...state, threshold: action.value };

    case "DEFECT_CONFIRM":
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.inspectionId, (i) =>
          mapDefect(i, action.defectId, (d) => ({ ...d, review: "confirmed" }))
        ),
      };

    case "DEFECT_EDIT":
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.inspectionId, (i) =>
          mapDefect(i, action.defectId, (d) => ({
            ...d,
            review: "edited",
            edited: { ...d.edited, ...action.edits },
          }))
        ),
      };

    case "DEFECT_DISMISS":
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.inspectionId, (i) =>
          mapDefect(i, action.defectId, (d) => ({ ...d, review: "dismissed" }))
        ),
      };

    case "DEFECT_RESTORE":
      // A reviewer-added defect has no ai_* fallback — its data lives only in
      // `edited`, so restoring it must go back to "reviewer_added" and keep
      // `edited` intact, not wipe it the way an AI-proposed defect's does.
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.inspectionId, (i) =>
          mapDefect(i, action.defectId, (d) =>
            d.ai_type === null
              ? { ...d, review: "reviewer_added" }
              : { ...d, review: "pending", edited: undefined }
          )
        ),
      };

    case "DEFECT_ADD":
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.inspectionId, (i) => ({
          ...i,
          defects: [
            ...i.defects,
            {
              id: newId("df"),
              ai_type: null,
              ai_severity: null,
              ai_confidence: null,
              ai_bbox: null,
              review: "reviewer_added",
              edited: { ...action.defect },
            },
          ],
        })),
      };

    case "SET_RESULT_MODE":
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.inspectionId, (i) => ({
          ...i,
          result_mode: action.mode,
        })),
      };

    case "SET_REVIEWER_CATEGORY":
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.inspectionId, (i) => ({
          ...i,
          reviewer_category: action.category,
        })),
      };

    case "SET_NOTES":
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.inspectionId, (i) => ({
          ...i,
          notes: action.notes,
        })),
      };

    case "FINALIZE_SAVED":
      // Replace wholesale — the server response IS the new source of truth
      // for this record, not a patch on top of the client's guess of it.
      return {
        ...state,
        inspections: mapInspection(state.inspections, action.inspection.id, () => action.inspection),
      };

    case "SET_TAB":
      return { ...state, activeTab: action.tab };

    case "TOAST":
      return {
        ...state,
        toasts: [
          ...state.toasts,
          {
            id: newId("toast"),
            message: action.message,
            tone: action.tone ?? "info",
            action: action.action,
          },
        ],
      };

    case "ANNOUNCE":
      return { ...state, announcement: { id: newId("say"), message: action.message } };

    case "DISMISS_TOAST":
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };

    case "TOGGLE_THEME":
      return { ...state, theme: state.theme === "dark" ? "light" : "dark" };

    default:
      return state;
  }
}

function initState(initialInspections: Inspection[]): State {
  return {
    inspections: initialInspections,
    threshold: 75,
    activeTab: "hub",
    theme: "dark",
    toasts: [],
    scan: null,
    simulateInvalidJson: false,
    activeHubId: null,
    scanMeta: {},
    announcement: null,
  };
}

type StoreContextValue = { state: State; dispatch: Dispatch<Action> };

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({
  children,
  initialInspections,
  loadError = null,
}: {
  children: ReactNode;
  // What app/layout.tsx (a Server Component) fetched from Supabase before the
  // page ever reached the browser — every 'completed' record on record, plus
  // anything else still open from a session that never got this far. Nothing
  // before Finalize has ever touched the database, so this is the ONLY
  // moment the store's inspections come from anywhere but local reducer state.
  initialInspections: Inspection[];
  // Set if that fetch itself failed (bad credentials, project unreachable) —
  // surfaced as a toast rather than silently starting empty, so a real outage
  // doesn't look identical to "no records yet".
  loadError?: string | null;
}) {
  const [state, dispatch] = useReducer(reducer, initialInspections, initState);
  const announced = useRef(false);

  useEffect(() => {
    if (!loadError || announced.current) return;
    announced.current = true;
    dispatch({
      type: "TOAST",
      message: `Couldn't load saved records: ${loadError}`,
      tone: "error",
    });
  }, [loadError]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within a StoreProvider");
  return ctx;
}
