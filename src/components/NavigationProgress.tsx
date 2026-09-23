"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin top progress bar that starts as soon as an in-app link is clicked,
 * and clears when the URL settles. Complements route `loading.tsx` skeletons.
 */
function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setActive(false);
  }, []);

  const start = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    // Avoid flash on instant navigations
    timer.current = setTimeout(() => setActive(true), 80);
  }, []);

  useEffect(() => {
    stop();
  }, [pathname, searchParams, stop]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const el = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!el) return;
      const href = el.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (el.target === "_blank" || el.hasAttribute("download")) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        return;
      }
      start();
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [start]);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" aria-hidden>
      <div className="nav-progress h-full w-full origin-left bg-brand-500" />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
