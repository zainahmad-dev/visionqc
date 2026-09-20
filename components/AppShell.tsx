import type { ReactNode } from "react";
import TopBar from "./TopBar";
import SideNav from "./SideNav";
import BottomNav from "./BottomNav";
import PageTransition from "./PageTransition";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1">
        <SideNav />
        <main className="bg-hairline-grid bg-noise relative flex-1 overflow-x-hidden">
          <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
