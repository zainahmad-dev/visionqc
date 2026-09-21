"use client";

import { motion, useReducedMotion } from "framer-motion";

// A horizontal light sweeping down the preview image while a scan is active.
export default function ScannerOverlay() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-card)]">
      <div className="absolute inset-0" style={{ background: "rgba(6, 182, 212, 0.08)" }} />
      {!reduceMotion && (
        <motion.div
          className="absolute inset-x-0 h-16"
          style={{
            background:
              "linear-gradient(to bottom, transparent, rgba(6, 182, 212, 0.55), transparent)",
          }}
          animate={{ top: ["-10%", "100%"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}
