"use client";

import { useEffect, useState } from "react";

// The store is in-memory today, so there is nothing to wait for — but the page
// is built for the phase-10 database, where the first load is real. This
// simulates that first load so the skeleton state exists and is testable.
//
// It runs once per browser session: coming back to Logs later is instant, as a
// warm cache would be. It always starts `false` on the very first visit (which
// is also what the server renders), so hydration matches; timestamps and other
// locale-dependent text only ever render after it flips.
let hasLoadedOnce = false;

export function useInitialLoad(ms = 450): boolean {
  const [loaded, setLoaded] = useState(() => hasLoadedOnce);

  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => {
      hasLoadedOnce = true;
      setLoaded(true);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [loaded, ms]);

  return loaded;
}
