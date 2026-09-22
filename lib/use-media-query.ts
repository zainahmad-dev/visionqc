import { useSyncExternalStore } from "react";

// Subscribes to a CSS media query. `serverValue` is what the server (and the
// hydration pass) assumes; the real answer replaces it straight after.
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}
