"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

type Outcome = { url: string; status: "loaded" | "failed" };

// The image may 404 (mock URLs) or be a stale blob — fall back to an icon tile
// rather than a broken-image glyph. The <img> stays invisible until it has
// really loaded, so nothing broken is ever painted while a 404 is in flight.
// The outcome is tied to its URL, so a new URL starts fresh.
export default function RecordThumb({ url, className = "" }: { url: string; className?: string }) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const status = outcome?.url === url ? outcome.status : null;

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-control)] bg-[var(--color-border)] ${className}`}
    >
      {status === "failed" ? (
        <ImageOff size={16} className="text-[var(--color-text-muted)]" aria-hidden="true" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- locally-decoded blob or mock URL, may 404
        <img
          src={url}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ opacity: status === "loaded" ? 1 : 0 }}
          onLoad={() => setOutcome({ url, status: "loaded" })}
          onError={() => setOutcome({ url, status: "failed" })}
        />
      )}
    </div>
  );
}
