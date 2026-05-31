"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function ScrollToTop() {
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is intentionally used as a trigger to scroll on route change
  useEffect(() => {
    // A small timeout ensures React has committed the new DOM before we force the scroll,
    // preventing the browser from getting stuck at the bottom of the previous page's scroll position.
    const timeoutId = setTimeout(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant",
      });
    }, 10);

    return () => clearTimeout(timeoutId);
  }, [pathname]);

  return null;
}
