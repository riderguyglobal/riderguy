'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import {
  ArrowLeft,
  Package,
  CreditCard,
  Megaphone,
  Star,
  Bell,
  Smartphone,
} from 'lucide-react';

const STORAGE_KEY = 'riderguy:notif_prefs';

interface NotifPrefs {
  orderUpdates:   boolean;
  paymentAlerts:  boolean;
  promotions:     boolean;
  ratingReminders:boolean;
  pushEnabled:    boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  orderUpdates:    true,
  paymentAlerts:   true,
  promotions:      true,
  ratingReminders: true,
  pushEnabled:     true,
};

const PREF_ITEMS = [
  {
    key: 'orderUpdates' as const,
    icon: Package,
    iconBg: 'bg-brand-500',
    label: 'Order Updates',
    sublabel: 'Status changes, rider assigned, delivered',
  },
  {
    key: 'paymentAlerts' as const,
    icon: CreditCard,
    iconBg: 'bg-blue-500',
    label: 'Payment Alerts',
    sublabel: 'Transactions, wallet top-ups, receipts',
  },
  {
    key: 'promotions' as const,
    icon: Megaphone,
    iconBg: 'bg-amber-500',
    label: 'Promotions & Offers',
    sublabel: 'Discounts, promo codes, special deals',
  },
  {
    key: 'ratingReminders' as const,
    icon: Star,
    iconBg: 'bg-yellow-400',
    label: 'Rating Reminders',
    sublabel: 'Prompts to rate after delivery',
  },
];

export default function NotificationPrefsPage() {
  const router  = useRouter();
  const { api } = useAuth();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) }); }
      catch { /* ignore */ }
    }
    setPushSupported('Notification' in window);
  }, []);

  function toggle(key: keyof NotifPrefs) {
    setPrefs(p => {
      const next = { ...p, [key]: !p[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Sync with server (fire-and-forget)
      if (api) {
        api.patch('/users/notification-preferences', next).catch(() => {});
      }
      return next;
    });
  }

  async function requestPushPermission() {
    if (!pushSupported) return;
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      toggle('pushEnabled');
    }
  }

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-surface-50 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-white shadow-card">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <p className="flex-1 text-[17px] font-bold text-surface-900">Notifications</p>
      </div>

      <div className="px-5 pb-10 space-y-4">

        {/* ── Push toggle ──────────────────────────── */}
        {pushSupported && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-4">
              <div className="h-10 w-10 rounded-xl bg-surface-900 flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-surface-900">Push Notifications</p>
                <p className="text-[12px] text-surface-400 mt-0.5">
                  {prefs.pushEnabled ? 'Enabled on this device' : 'Disabled — tap to enable'}
                </p>
              </div>
              <Toggle
                value={prefs.pushEnabled}
                onChange={() => prefs.pushEnabled ? toggle('pushEnabled') : requestPushPermission()}
              />
            </div>
          </div>
        )}

        {/* ── Category toggles ─────────────────────── */}
        <div>
          <p className="section-label mb-3">Notification Types</p>
          <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-surface-50">
            {PREF_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-center gap-3 px-4 py-3.5">
                  <div className={`h-10 w-10 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-semibold text-surface-900">{item.label}</p>
                    <p className="text-[12px] text-surface-400 mt-0.5">{item.sublabel}</p>
                  </div>
                  <Toggle
                    value={prefs[item.key]}
                    onChange={() => toggle(item.key)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Info note ────────────────────────────── */}
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-surface-100">
          <Bell className="h-4 w-4 text-surface-400 flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-surface-500 leading-relaxed">
            Order update notifications are always sent regardless of preferences to ensure you're aware of critical delivery events.
          </p>
        </div>

      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={[
        'relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0',
        value ? 'bg-brand-500' : 'bg-surface-200',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-200',
          value ? 'left-[22px]' : 'left-0.5',
        ].join(' ')}
      />
    </button>
  );
}
