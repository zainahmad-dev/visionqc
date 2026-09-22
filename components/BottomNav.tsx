"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { NAV_ITEMS } from "@/lib/nav-items";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 backdrop-blur-sm md:hidden"
      style={{ height: "var(--bottom-nav-h)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium"
            style={{
              color: isActive ? "var(--color-accent-cyan)" : "var(--color-text-secondary)",
              minHeight: 44,
            }}
          >
            {isActive && (
              <motion.span
                layoutId="bottom-nav-indicator"
                className="absolute top-0 h-0.5 w-8 rounded-full"
                style={{ background: "var(--gradient-accent)" }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon size={20} strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
