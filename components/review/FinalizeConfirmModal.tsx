"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { Inspection, Review } from "@/lib/types";
import { autoResult } from "@/lib/rules";
import { useStore } from "@/lib/store";
import Modal from "./Modal";

const COUNTER_ORDER: Review[] = ["confirmed", "edited", "dismissed", "reviewer_added"];
const COUNTER_LABEL: Record<Review, string> = {
  pending: "pending",
  confirmed: "confirmed",
  edited: "edited",
  dismissed: "dismissed",
  reviewer_added: "added",
};

type Stage = "confirm" | "loading" | "success";

export default function FinalizeConfirmModal({
  inspection,
  open,
  onClose,
}: {
  inspection: Inspection;
  open: boolean;
  onClose: () => void;
}) {
  const { dispatch } = useStore();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>("confirm");

  const counts = COUNTER_ORDER.map((review) => ({
    review,
    n: inspection.defects.filter((d) => d.review === review).length,
  }));
  const finalResult =
    inspection.result_mode === "auto" ? autoResult(inspection) : inspection.result_mode === "override_pass" ? "pass" : "fail";

  // Escape/backdrop close only from the confirm step — once saving starts
  // there's nothing to back out of, and the flow ends by navigating away.
  function handleClose() {
    if (stage === "confirm") onClose();
  }

  function handleConfirm() {
    dispatch({ type: "FINALIZE", inspectionId: inspection.id });
    setStage("loading");
    window.setTimeout(
      () => {
        setStage("success");
        window.setTimeout(
          () => {
            dispatch({ type: "TOAST", message: `${inspection.id} finalized and saved.`, tone: "success" });
            router.push(`/logs?highlight=${inspection.id}`);
          },
          reduceMotion ? 80 : 900
        );
      },
      reduceMotion ? 80 : 700
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

      {stage !== "confirm" && (
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
