'use client';

import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import type { OrderStatus } from '@riderguy/types';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const cfg = ORDER_STATUS_CONFIG[status];
  if (!cfg) return null;
  return (
    <span className={`${cfg.badgeClass} ${className}`}>
      {cfg.label}
    </span>
  );
}

interface StatusDotProps {
  status: string;
  className?: string;
}

export function StatusDot({ status, className = '' }: StatusDotProps) {
  const cfg = ORDER_STATUS_CONFIG[status];
  if (!cfg) return null;
  return <span className={`${cfg.dotClass} ${className}`} />;
}
