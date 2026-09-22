import { Check, Loader2 } from "lucide-react";
import { PHASE_LABEL, PHASE_ORDER, type ScanPhase } from "@/lib/scan";

export default function ScanStepper({ currentPhase }: { currentPhase: ScanPhase }) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);

  return (
    <ol className="flex flex-col gap-2">
      {PHASE_ORDER.map((phase, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "active" : "waiting";
        return (
          <li key={phase} className="flex items-center gap-2.5 text-sm">
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]"
              style={{
                borderColor:
                  state === "waiting" ? "var(--color-border-strong)" : "var(--color-accent-cyan)",
                background: state === "done" ? "var(--color-accent-cyan)" : "transparent",
                color: state === "done" ? "#04121a" : "var(--color-accent-cyan)",
              }}
            >
              {state === "done" && <Check size={12} strokeWidth={3} />}
              {state === "active" && <Loader2 size={12} className="motion-safe:animate-spin" />}
              {state === "waiting" && <span>{index + 1}</span>}
            </span>
            <span
              style={{
                color:
                  state === "waiting" ? "var(--color-text-muted)" : "var(--color-text-primary)",
              }}
            >
              {PHASE_LABEL[phase]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
