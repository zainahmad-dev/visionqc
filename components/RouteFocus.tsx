"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// After a client-side navigation the link you activated is gone, and the browser
// drops focus on <body> — so the next Tab would restart at the skip link and walk
// the whole nav again. Moving focus to <main> puts the reviewer at the top of the
// new content instead. It compares against the previous value (rather than "is this
// the first render") so React's dev double-invoke can't fire it on the initial load.
export function useFocusMainOnChange(value: string | null) {
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [value]);
}

export default function RouteFocus() {
  useFocusMainOnChange(usePathname());
  return null;
}
