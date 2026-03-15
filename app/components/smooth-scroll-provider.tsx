"use client";

import { useEffect } from "react";
import Lenis from "lenis";

type SmoothScrollProviderProps = {
  children: React.ReactNode;
};

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const smallScreenQuery = window.matchMedia("(max-width: 1023px)");
    const touchDeviceQuery = window.matchMedia("(hover: none) and (pointer: coarse)");

    let lenis: Lenis | null = null;
    let rafId = 0;

    const stopLenis = () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }

      if (lenis) {
        lenis.destroy();
        lenis = null;
      }
    };

    const startLenis = () => {
      if (lenis) {
        return;
      }

      lenis = new Lenis({
        duration: 1.1,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 0.85,
        touchMultiplier: 1.1,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });

      const raf = (time: number) => {
        lenis?.raf(time);
        rafId = window.requestAnimationFrame(raf);
      };

      rafId = window.requestAnimationFrame(raf);
    };

    const syncScrollingMode = () => {
      const shouldDisableSmoothScroll =
        reducedMotionQuery.matches || smallScreenQuery.matches || touchDeviceQuery.matches;

      if (shouldDisableSmoothScroll) {
        stopLenis();
        return;
      }

      startLenis();
    };

    syncScrollingMode();

    reducedMotionQuery.addEventListener("change", syncScrollingMode);
    smallScreenQuery.addEventListener("change", syncScrollingMode);
    touchDeviceQuery.addEventListener("change", syncScrollingMode);

    return () => {
      reducedMotionQuery.removeEventListener("change", syncScrollingMode);
      smallScreenQuery.removeEventListener("change", syncScrollingMode);
      touchDeviceQuery.removeEventListener("change", syncScrollingMode);
      stopLenis();
    };
  }, []);

  return <>{children}</>;
}
