import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

// False on the server and during hydration, true afterwards — the React-blessed
// way to gate client-only output (locale dates, Date.now()) without a
// setState-in-effect flash.
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
}
