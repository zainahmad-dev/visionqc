"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// One switch for framer-motion across the app: with prefers-reduced-motion set,
// transform and layout animations are skipped everywhere (opacity fades stay,
// which is the recommended reduced form). Looping effects are additionally
// guarded per component with useReducedMotion / motion-safe.
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
