import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import { StoreProvider } from "@/lib/store";
import { listInspections } from "@/lib/actions";
import ScanEngine from "@/components/ScanEngine";
import ToastHost from "@/components/ToastHost";
import Announcer from "@/components/Announcer";
import MotionProvider from "@/components/MotionProvider";

// Every 'completed' record lives in Supabase, not in this process — a hard
// refresh must see the latest of them, so this layout (and everything under
// it) always renders at request time rather than being frozen into a build-
// time prerender.
export const dynamic = "force-dynamic";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "VisionQC",
  description: "Local vision-model quality control review console",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("visionqc-theme");
    if (stored === "light") {
      document.documentElement.dataset.theme = "light";
    }
  } catch (e) {}
})();
`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nothing before Finalize ever touches the database — this fetch is the one
  // exception: it's a read, done once per hard navigation, seeding the store
  // with what earlier sessions already saved. A failure here (bad env vars, a
  // project that's unreachable) shouldn't take the whole app down; it starts
  // empty instead, and the reviewer is told why via a toast (see StoreProvider).
  let initialInspections: Awaited<ReturnType<typeof listInspections>> = [];
  let loadError: string | null = null;
  try {
    initialInspections = await listInspections();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "unknown error";
    console.error("Failed to load inspections from Supabase:", err);
  }

  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        {/* First tab stop on every page: jumps past the top bar and navigation. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:flex focus:min-h-11 focus:items-center focus:rounded-[var(--radius-control)] focus:border focus:border-[var(--color-accent-cyan)] focus:bg-[var(--color-surface-raised)] focus:px-4 focus:text-sm focus:font-medium focus:text-[var(--color-text-primary)] focus:shadow-lg"
        >
          Skip to main content
        </a>
        <MotionProvider>
          <StoreProvider initialInspections={initialInspections} loadError={loadError}>
            <ScanEngine />
            <Announcer />
            <AppShell>{children}</AppShell>
            <ToastHost />
          </StoreProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
