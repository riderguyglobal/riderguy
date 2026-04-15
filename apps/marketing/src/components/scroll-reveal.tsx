'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Wraps page content and observes .reveal / .stagger
 * elements, adding .visible when they enter the viewport.
 */
export function ScrollRevealProvider({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const selectors = '.reveal,.reveal-left,.reveal-right,.reveal-scale,.stagger';

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' },
    );

    root.querySelectorAll(selectors).forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
