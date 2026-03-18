'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@riderguy/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@riderguy/ui';
import { Bell, Check, CheckCheck, ChevronLeft, Package, CreditCard, AlertTriangle, Star, Megaphone } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, typeof Bell> = {
  ORDER_UPDATE: Package,
  PAYMENT: CreditCard,
  PROMOTION: Megaphone,
  RATING: Star,
  ALERT: AlertTriangle,
};

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-GH', { month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const router = useRouter();
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', filter],
    queryFn: async () => {
      const res = await api!.get('/notifications', {
        params: { pageSize: '50' },
      });
      return (res.data.data ?? []) as Notification[];
    },
    enabled: !!api,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await api!.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await api!.patch('/notifications/read-all');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = filter === 'unread'
    ? (data ?? []).filter((n) => !n.isRead)
    : (data ?? []);

  const unreadCount = (data ?? []).filter((n) => !n.isRead).length;

  const handleTap = useCallback((n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    // Deep link based on notification data
    const orderId = n.data?.orderId as string | undefined;
    if (orderId) {
      router.push(`/dashboard/orders/${orderId}/tracking`);
    }
  }, [markRead, router]);

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1 -ml-1">
              <ChevronLeft className="h-5 w-5 text-surface-600" />
            </button>
            <h1 className="text-xl font-bold text-surface-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-brand-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-sm font-semibold text-brand-500 hover:text-brand-600 disabled:opacity-50"
            >
              <CheckCheck className="h-4 w-4 inline mr-1" />
              Read all
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex mx-5 mb-3 bg-surface-100 rounded-xl p-1">
          {(['all', 'unread'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                filter === key
                  ? 'bg-white text-surface-900 shadow-sm'
                  : 'text-surface-400'
              }`}
            >
              {key === 'all' ? 'All' : 'Unread'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-5 py-3">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
              <Bell className="h-7 w-7 text-surface-300" />
            </div>
            <p className="text-surface-500 font-medium">
              {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
            </p>
            <p className="text-surface-400 text-sm mt-1">
              {filter === 'unread' ? 'You have no unread notifications' : "We'll notify you about your deliveries"}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((n) => {
              const Icon = TYPE_ICON[n.type] ?? Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleTap(n)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
                    n.isRead
                      ? 'opacity-60'
                      : 'bg-brand-50/50'
                  }`}
                >
                  <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    n.isRead
                      ? 'bg-surface-100'
                      : 'bg-brand-100'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      n.isRead ? 'text-surface-400' : 'text-brand-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm truncate ${
                        n.isRead ? 'font-medium text-surface-600' : 'font-semibold text-surface-900'
                      }`}>{n.title}</p>
                      {!n.isRead && <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-surface-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
