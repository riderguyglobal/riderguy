'use client';

import { useCallback } from 'react';
import { useAuth } from '@riderguy/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@riderguy/ui';
import {
  Bell,
  CheckCheck,
  ArrowLeft,
  Package,
  CreditCard,
  AlertTriangle,
  Star,
  Megaphone,
} from 'lucide-react';
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

const TYPE_CONFIG: Record<string, { icon: typeof Bell; bg: string; color: string }> = {
  ORDER_UPDATE: { icon: Package,       bg: 'bg-brand-100',   color: 'text-brand-600'   },
  PAYMENT:      { icon: CreditCard,    bg: 'bg-blue-100',    color: 'text-blue-600'    },
  PROMOTION:    { icon: Megaphone,     bg: 'bg-amber-100',   color: 'text-amber-600'   },
  RATING:       { icon: Star,          bg: 'bg-yellow-100',  color: 'text-yellow-600'  },
  ALERT:        { icon: AlertTriangle, bg: 'bg-red-100',     color: 'text-red-600'     },
};

function groupByDate(notifs: Notification[]): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {};
  const now       = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);

  notifs.forEach(n => {
    const d = new Date(n.createdAt);
    let key: string;
    if (d.toDateString() === now.toDateString()) {
      key = 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else {
      key = d.toLocaleDateString([], {
        month: 'long',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(n);
  });
  return groups;
}

function relativeTime(date: string): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60)  return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const router       = useRouter();
  const { api }      = useAuth();
  const queryClient  = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api!.get('/notifications', { params: { pageSize: '50' } });
      return (res.data.data ?? []) as Notification[];
    },
    enabled: !!api,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api!.patch(`/notifications/${id}/read`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api!.patch('/notifications/read-all'),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleTap = useCallback((n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    const orderId = n.data?.orderId as string | undefined;
    if (orderId) router.push(`/dashboard/orders/${orderId}/tracking`);
  }, [markRead, router]);

  const notifications = data ?? [];
  const unreadCount   = notifications.filter(n => !n.isRead).length;
  const grouped       = groupByDate(notifications);

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-white sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 12 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-surface-100 !shadow-none">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <p className="text-[17px] font-bold text-surface-900">Notifications</p>
          {unreadCount > 0 && (
            <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-surface-100 text-[12px] font-bold text-surface-600 active:scale-95 transition-all disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      {/* ── Content ──────────────────────────────── */}
      <div className="px-5 pb-6">
        {isLoading ? (
          <div className="space-y-3 mt-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex gap-3 py-2">
                <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-3.5 w-40 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-2.5 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-3">
              <Bell className="h-7 w-7 text-surface-300" />
            </div>
            <p className="text-[15px] font-bold text-surface-700">No notifications yet</p>
            <p className="text-[13px] text-surface-400 mt-1">
              We'll let you know about your deliveries here.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            {Object.entries(grouped).map(([date, notifs]) => (
              <div key={date}>
                <p className="section-label mb-2 px-1">{date}</p>
                <div className="bg-white rounded-2xl overflow-hidden divide-y divide-surface-50 shadow-card">
                  {notifs.map(n => {
                    const cfg   = TYPE_CONFIG[n.type] ?? { icon: Bell, bg: 'bg-surface-100', color: 'text-surface-500' };
                    const Icon  = cfg.icon;
                    return (
                      <button
                        key={n.id}
                        onClick={() => handleTap(n)}
                        className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors active:bg-surface-50 ${
                          !n.isRead ? 'notif-row-unread' : 'notif-row-read'
                        }`}
                      >
                        {/* Icon */}
                        <div className={`notif-icon-wrap ${cfg.bg} flex-shrink-0`}>
                          <Icon className={`h-5 w-5 ${cfg.color}`} />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-[14px] leading-snug ${
                              n.isRead ? 'font-medium text-surface-600' : 'font-bold text-surface-900'
                            }`}>
                              {n.title}
                            </p>
                            {!n.isRead && <span className="notif-dot mt-1.5 flex-shrink-0" />}
                          </div>
                          <p className="text-[13px] text-surface-500 mt-0.5 line-clamp-2 leading-snug">
                            {n.body}
                          </p>
                          <p className="text-[11px] text-surface-400 mt-1">
                            {relativeTime(n.createdAt)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
