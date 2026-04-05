'use client';

import { useEffect, useRef } from 'react';

export function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );

    // Observe the element itself and any children with reveal classes
    const revealClasses = ['reveal', 'reveal-left', 'reveal-right', 'reveal-scale', 'stagger-children'];
    const targets: Element[] = [];

    revealClasses.forEach((cls) => {
      if (el.classList.contains(cls)) targets.push(el);
      el.querySelectorAll(`.${cls}`).forEach((child) => targets.push(child));
    });

    targets.forEach((target) => observer.observe(target));

    return () => observer.disconnect();
  }, []);

  return ref;
}
