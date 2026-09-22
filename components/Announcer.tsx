"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav-items";
import { PHASE_LABEL } from "@/lib/scan";
import { useStore } from "@/lib/store";

// The app's ONE polite live region. Screen readers hear:
//   - scan progress   ("Scanning VQ-10421: Running Vision Vector Analysis.")
//   - saves           (the toasts: "VQ-10421 finalized and saved.")
//   - undo            (the toast's "Undo available", then "…restored.")
//   - page changes    ("Logs page")
// Each message is its own keyed <p>, so a new one is inserted (and therefore
// spoken) rather than an old one silently edited. Visible toasts are NOT live
// regions themselves — that would read everything twice.
export default function Announcer() {
  const { state } = useStore();
  const pathname = usePathname();

  const scan = state.scan;
  const toast = state.toasts[state.toasts.length - 1];
  const page = NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label;

  return (
    <div role="status" aria-live="polite" aria-atomic="false" className="sr-only" data-announcer="">
      {scan && (
        <p key={`${scan.inspectionId}-${scan.phase}`}>
          Scanning {scan.inspectionId}: {PHASE_LABEL[scan.phase]}.
        </p>
      )}
      {toast && (
        <p key={toast.id}>
          {toast.message}
          {toast.action ? ` ${toast.action.label.replace(/->/g, "").trim()} available.` : ""}
        </p>
      )}
      {state.announcement && <p key={state.announcement.id}>{state.announcement.message}</p>}
      {page && <p key={pathname}>{page} page</p>}
    </div>
  );
}
