'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import { ORDER_STATUS_CONFIG } from '@/lib/constants';
import type { Order } from '@riderguy/types';

export default function TrackPage() {
  const router = useRouter();
  const { api } = useAuth();

  const { data: orders } = useQuery<Order[]>({
    queryKey: ['recent-orders'],
    queryFn: async () => {
      const res = await api!.get('/orders', { params: { limit: 10, sort: '-createdAt' } });
      return res.data.data ?? [];
    },
    enabled: !!api,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!orders) return;
    const active = orders.find(o => ORDER_STATUS_CONFIG[o.status]?.isActive);
    if (active) {
      router.replace(`/dashboard/orders/${active.id}/tracking`);
    } else {
      router.replace('/dashboard/orders');
    }
  }, [orders, router]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-[3px] border-brand-500 border-t-transparent animate-spin" />
    </div>
  );
}
