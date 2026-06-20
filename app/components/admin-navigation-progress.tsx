"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function AdminNavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function clearAllTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  // Navigation completed — drive bar to 100% and fade out
  useEffect(() => {
    if (!visible) return;
    clearAllTimers();
    setWidth(100);
    const t1 = setTimeout(() => setOpacity(0), 150);
    const t2 = setTimeout(() => {
      setVisible(false);
      setWidth(0);
      setOpacity(1);
    }, 500);
    timers.current = [t1, t2];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Detect navigation intent from link clicks and form submissions
  useEffect(() => {
    function startNav() {
      clearAllTimers();
      setVisible(true);
      setOpacity(1);
      setWidth(0);
      const t1 = setTimeout(() => setWidth(28), 30);
      const t2 = setTimeout(() => setWidth(55), 600);
      const t3 = setTimeout(() => setWidth(75), 1400);
      const t4 = setTimeout(() => setWidth(85), 2800);
      timers.current = [t1, t2, t3, t4];
    }

    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      startNav();
    }

    function handleSubmit() {
      startNav();
    }

    document.addEventListener("click", handleClick);
    document.addEventListener("submit", handleSubmit);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("submit", handleSubmit);
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[300] h-[2px] bg-primary/10"
      style={{ opacity }}
    >
      <div
        className="h-full bg-primary"
        style={{
          width: `${width}%`,
          transition:
            width === 0
              ? "none"
              : width === 100
                ? "width 0.18s ease-out"
                : "width 1.1s ease-out",
        }}
      />
    </div>
  );
}
