"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Returns a ref and a boolean indicating whether the element is in view.
 * Uses IntersectionObserver to trigger section-reveal animations.
 * Once triggered, stays true (no re-hide on scroll away).
 */
export function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}
