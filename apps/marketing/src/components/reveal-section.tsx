'use client';

import React from 'react';
import { useReveal } from '@/hooks/use-reveal';
import { cn } from '@riderguy/ui';

interface RevealSectionProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'up' | 'left' | 'right' | 'scale' | 'stagger';
  as?: 'section' | 'div' | 'article';
}

export function RevealSection({
  children,
  className,
  variant = 'up',
  as: Tag = 'div',
}: RevealSectionProps) {
  const ref = useReveal();

  const variantClass = {
    up: 'reveal',
    left: 'reveal-left',
    right: 'reveal-right',
    scale: 'reveal-scale',
    stagger: 'stagger-children',
  }[variant];

  return (
    <Tag ref={ref} className={cn(variantClass, className)}>
      {children}
    </Tag>
  );
}
