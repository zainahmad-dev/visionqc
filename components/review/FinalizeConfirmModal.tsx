"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import type { Inspection, Review } from "@/lib/types";
import { autoResult } from "@/lib/rules";
import { useStore } from "@/lib/store";
import { saveInspection } from "@/lib/actions";
import { forgetUploadedFile, takeUploadedFile } from "@/lib/image-cache";
import Modal from "./Modal";

const COUNTER_ORDER: Review[] = ["confirmed", "edited", "dismissed", "reviewer_added"];
const COUNTER_LABEL: Record<Review, string> = {
  pending: "pending",
  confirmed: "confirmed",
  edited: "edited",
  dismissed: "dismissed",
  reviewer_added: "added",
};

type Stage = "confirm" | "loading" | "success" | "error";

export default function FinalizeConfirmModal({
  inspection,
  open,
  onClose,
}: {
  inspection: Inspection;
  open: boolean;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>("confirm");
  const [error, setError] = useState<string | null>(null);

  const counts = COUNTER_ORDER.map((review) => ({
    review,
    n: inspection.defects.filter((d) => d.review === review).length,
  }));
  const finalResult =
    inspection.result_mode === "auto" ? autoResult(inspection) : inspection.result_mode === "override_pass" ? "pass" : "fail";

  // Escape/backdrop close from confirm or a stopped-with-error step — once
  // saving is actually in flight there's nothing to back out of, and success
  // ends the flow by navigating away on its own.
  function handleClose() {
    if (stage === "confirm" || stage === "error") onClose();
  }

  async function handleConfirm() {
    setError(null);
    setStage("loading");

    // The blob: URL in inspection.image_url only exists in this tab — the
    // actual bytes were parked here at upload time (lib/image-cache.ts) for
    // exactly this moment.
    const file = takeUploadedFile(inspection.id);
    if (!file) {
      setStage("error");
      setError("The original image isn't available in this session anymore. Re-scan it from the Hub to finalize.");
      return;
    }

    const formData = new FormData();
    formData.append("inspection", JSON.stringify(inspection));
    formData.append("threshold", String(state.threshold));
    formData.append("image", file);

    const result = await saveInspection(formData);
    if (!result.ok) {
      setStage("error");
      setError(result.error);
      return;
    }

    forgetUploadedFile(inspection.id);
    dispatch({ type: "FINALIZE_SAVED", inspection: result.inspection });
    setStage("success");
    window.setTimeout(
      () => {
        dispatch({ type: "TOAST", message: `${inspection.id} finalized and saved.`, tone: "success" });
        router.push(`/logs?highlight=${inspection.id}`);
      },
      reduceMotion ? 80 : 900
    );
  }

  return (
    <Modal open={open} onClose={handleClose} label={`Finalize ${inspection.id}`}>
      {stage === "confirm" && (
        <>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Finalize {inspection.id}?</h2>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            This saves the record — it won&apos;t be editable from Review afterward.
          </p>

          <div className="mt-4 flex flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 font-mono text-xs text-[var(--color-text-secondary)]">
            {counts.map((c) => (
              <span key={c.review}>
                {c.n} {COUNTER_LABEL[c.review]}
              </span>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-[var(--color-text-secondary)]">Final result:</span>
            <span
              className="font-semibold uppercase"
              style={{ color: finalResult === "pass" ? "var(--color-pass)" : "var(--color-fail)" }}
            >
              {finalResult}
            </span>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--gradient-accent-strong)" }}
            >
              Confirm & Save
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {stage === "error" && (
        <>
          <div className="flex items-start gap-2">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-[var(--color-fail)]" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Couldn&apos;t save {inspection.id}</h2>
              <p role="alert" className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {error}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            Nothing was saved — the record is exactly as it was before you pressed Confirm & Save.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setStage("confirm")}
              className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--gradient-accent-strong)" }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-11 flex-1 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-3 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {(stage === "loading" || stage === "success") && (
        <div className="flex flex-col items-center gap-4 py-6">
          <AnimatePresence mode="wait">
            {stage === "loading" ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
              >
                <Loader2 size={40} className="motion-safe:animate-spin text-[var(--color-accent-cyan)]" />
              </motion.div>
            ) : (
              <motion.div
                key="success"
                className="relative flex items-center justify-center"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduceMotion ? { duration: 0.01 } : { type: "spring", stiffness: 300, damping: 20 }}
              >
                <motion.span
                  className="absolute h-16 w-16 rounded-full"
                  style={{ background: "var(--color-pass)" }}
                  initial={{ scale: 0.4, opacity: 0.5 }}
                  animate={{ scale: 2.2, opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.01 : 0.6, ease: "easeOut" }}
                />
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "var(--color-pass)" }}
                >
                  <CheckCircle2 size={28} className="text-white" />
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {stage === "loading" ? "Saving record…" : "Saved."}
          </p>
        </div>
      )}
    </Modal>
  );
}
