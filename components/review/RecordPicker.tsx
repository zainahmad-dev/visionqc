"use client";

import { useState } from "react";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import type { Inspection } from "@/lib/types";
import { ERROR_REASON } from "@/lib/scan";
import StatusBadge from "@/components/StatusBadge";

function Thumb({ inspection }: { inspection: Inspection }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-border)]">
        <ImageOff size={16} className="text-[var(--color-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-border)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- locally-decoded blob or mock URL, may 404 */}
      <img
        src={inspection.image_url}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

function RecordCard({ inspection }: { inspection: Inspection }) {
  const defectCount = inspection.defects.length;
  const subtitle =
    inspection.status === "analyzed"
      ? `${inspection.category ?? "Uncategorized"} · ${defectCount} finding${defectCount === 1 ? "" : "s"}`
      : (inspection.error_code ? ERROR_REASON[inspection.error_code] : "Needs manual review");

  return (
    <li>
      <Link
        href={`/review?id=${inspection.id}`}
        className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-accent-cyan)] sm:flex-nowrap"
      >
        <Thumb inspection={inspection} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-mono text-sm text-[var(--color-text-primary)]">{inspection.id}</p>
            <StatusBadge status={inspection.status} />
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">{inspection.file_name}</p>
          <p className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
        <span
          className="flex h-11 shrink-0 items-center rounded-[var(--radius-control)] px-4 text-sm font-medium text-white"
          style={{ background: "var(--gradient-accent)" }}
        >
          Review
        </span>
      </Link>
    </li>
  );
}

export default function RecordPicker({ items }: { items: Inspection[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--color-border)] p-10 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">Nothing is waiting for review.</p>
        <Link
          href="/hub"
          className="flex h-11 items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] px-4 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-cyan)]"
        >
          Go to the Hub to scan an image
        </Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((inspection) => (
        <RecordCard key={inspection.id} inspection={inspection} />
      ))}
    </ul>
  );
}
