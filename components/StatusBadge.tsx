import type { LucideIcon } from "lucide-react";
import { CheckCheck, CircleCheckBig, Clock, Loader2, TriangleAlert, XCircle } from "lucide-react";
import type { Status } from "@/lib/types";

const STATUS_META: Record<Status, { label: string; color: string; icon: LucideIcon; spin?: boolean }> = {
  queued: { label: "Queued", color: "var(--color-text-muted)", icon: Clock },
  scanning: { label: "Scanning", color: "var(--color-accent-cyan)", icon: Loader2, spin: true },
  analyzed: { label: "Ready to Review", color: "var(--color-accent-indigo)", icon: CircleCheckBig },
  needs_manual_review: { label: "Needs Manual Review", color: "var(--color-review)", icon: TriangleAlert },
  failed: { label: "Failed", color: "var(--color-fail)", icon: XCircle },
  completed: { label: "Completed", color: "var(--color-pass)", icon: CheckCheck },
};

export default function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
      style={{ borderColor: "var(--color-border)", color: meta.color }}
    >
      <Icon size={12} strokeWidth={2.5} className={meta.spin ? "animate-spin" : undefined} />
      {meta.label}
    </span>
  );
}
