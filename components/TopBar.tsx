"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanEye } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import ThresholdControl from "./ThresholdControl";
import { NAV_ITEMS } from "@/lib/nav-items";

function Breadcrumb() {
  const pathname = usePathname();
  const active = NAV_ITEMS.find((item) => pathname.startsWith(item.href));

  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-sm sm:flex">
      <span className="text-[var(--color-text-muted)]">VisionQC</span>
      {active && (
        <>
          <span className="text-[var(--color-text-muted)]">/</span>
          <span className="text-[var(--color-text-primary)]">{active.label}</span>
        </>
      )}
    </nav>
  );
}

export default function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 px-4 backdrop-blur-sm md:px-8">
      <div className="flex items-center gap-4">
        <Link href="/hub" className="flex min-h-11 items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-white"
            style={{ background: "var(--gradient-accent)" }}
          >
            <ScanEye size={18} strokeWidth={2.25} />
          </span>
          <span className="text-sm font-semibold tracking-tight text-[var(--color-text-primary)]">
            VisionQC
          </span>
        </Link>
        <Breadcrumb />
      </div>

      <div className="flex items-center gap-3">
        <ThresholdControl />
        <ThemeToggle />
      </div>
    </header>
  );
}
