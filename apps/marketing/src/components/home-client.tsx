'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface HomeClientProps {
  children: ReactNode;
}

export function HomeClient({ children }: HomeClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const revealSelectors = ['.reveal', '.reveal-left', '.reveal-right', '.reveal-scale', '.stagger-children'];
    const targets = container.querySelectorAll(revealSelectors.join(','));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -80px 0px' }
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef}>{children}</div>;
}
