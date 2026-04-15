'use client';

import { formatCurrency } from '@riderguy/utils';
import {
  MapPin,
  Route,
  Clock,
  Package,
  TrendingUp,
  Calendar,
  Layers,
  Shield,
  Bike,
  Zap,
  Weight,
  CloudRain,
  Sun,
  Moon,
  MapPinned,
  Tag,
  Building2,
} from 'lucide-react';

/**
 * API price estimate shape — mirrors PriceBreakdown from pricing.service.ts v2
 */
export interface PriceEstimate {
  haversineDistanceKm: number;
  distanceKm: number;
  routeDistanceKm?: number | null;
  roadFactor: number;
  estimatedDurationMinutes: number;
  baseFare: number;
  distanceCharge: number;
  stopSurcharges: number;
  additionalStops: number;
  packageMultiplier: number;
  packageType: string;
  weightSurcharge?: number;
  surgeMultiplier: number;
  surgeLevel?: string;
  timeOfDayMultiplier?: number;
  timeOfDayPeriod?: string;
  weatherMultiplier?: number;
  weatherCondition?: string;
  crossZoneMultiplier?: number;
  expressMultiplier?: number;
  isExpress?: boolean;
  expressIgnored?: boolean;
  scheduleDiscount: number;
  scheduleDiscountBlockedBySurge?: boolean;
  businessDiscount?: number;
  promoDiscount?: number;
  promoError?: string | null;
  subtotal: number;
  serviceFee: number;
  serviceFeeRate?: number;
  totalPrice: number;
  currency: string;
  zoneId?: string | null;
  zoneName?: string | null;
  riderEarnings: number;
  platformCommission: number;
  commissionRate?: number;
}

interface PriceBreakdownProps {
  estimate: PriceEstimate;
  /** Compact = just the bottom bar summary, expanded = full line items */
  variant?: 'compact' | 'expanded';
  className?: string;
}

/** Format km nicely */
function fmtKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

/** Format minutes */
function fmtMin(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Pick a time-of-day icon */
function TimeIcon({ period }: { period?: string }) {
  if (!period) return <Clock className="h-3.5 w-3.5" />;
  if (period.toLowerCase().includes('night') || period.toLowerCase().includes('late')) return <Moon className="h-3.5 w-3.5" />;
  return <Sun className="h-3.5 w-3.5" />;
}

// ─── Compact Variant ─────────────────────────────────

function CompactBreakdown({ estimate }: { estimate: PriceEstimate }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 text-surface-500">
        <div className="flex items-center gap-1">
          <Route className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{fmtKm(estimate.distanceKm)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">~{fmtMin(estimate.estimatedDurationMinutes)}</span>
        </div>
        {estimate.surgeMultiplier > 1 && (
          <div className="flex items-center gap-1 text-amber-500">
            <TrendingUp className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">{estimate.surgeMultiplier}×</span>
          </div>
        )}
        {estimate.isExpress && (
          <div className="flex items-center gap-1 text-brand-600">
            <Zap className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Express</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-[11px] text-surface-400 font-medium text-right">Estimated</p>
        <p className="text-xl font-bold text-surface-900">
          {formatCurrency(estimate.totalPrice, estimate.currency)}
        </p>
      </div>
    </div>
  );
}

// ─── Expanded Variant ────────────────────────────────

function ExpandedBreakdown({ estimate }: { estimate: PriceEstimate }) {
  const items: { icon: React.ReactNode; label: string; value: string; accent?: boolean; muted?: boolean; discount?: boolean }[] = [
    {
      icon: <MapPin className="h-3.5 w-3.5" />,
      label: 'Base fare',
      value: formatCurrency(estimate.baseFare, estimate.currency),
    },
    {
      icon: <Route className="h-3.5 w-3.5" />,
      label: `Distance (${fmtKm(estimate.distanceKm)})`,
      value: formatCurrency(estimate.distanceCharge, estimate.currency),
    },
  ];

  if (estimate.stopSurcharges > 0) {
    items.push({
      icon: <Layers className="h-3.5 w-3.5" />,
      label: `Extra stops (×${estimate.additionalStops})`,
      value: `+${formatCurrency(estimate.stopSurcharges, estimate.currency)}`,
    });
  }

  if (estimate.weightSurcharge && estimate.weightSurcharge > 0) {
    items.push({
      icon: <Weight className="h-3.5 w-3.5" />,
      label: 'Weight surcharge',
      value: `+${formatCurrency(estimate.weightSurcharge, estimate.currency)}`,
    });
  }

  if (estimate.packageMultiplier !== 1) {
    items.push({
      icon: <Package className="h-3.5 w-3.5" />,
      label: `${estimate.packageType.replace(/_/g, ' ').toLowerCase()} (${estimate.packageMultiplier}×)`,
      value: 'included',
      muted: true,
    });
  }

  if (estimate.surgeMultiplier > 1) {
    items.push({
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      label: `High demand${estimate.surgeLevel ? ` — ${estimate.surgeLevel.toLowerCase()}` : ''} (${estimate.surgeMultiplier}×)`,
      value: 'included',
      accent: true,
    });
  }

  if (estimate.timeOfDayMultiplier && estimate.timeOfDayMultiplier !== 1) {
    items.push({
      icon: <TimeIcon period={estimate.timeOfDayPeriod} />,
      label: `${estimate.timeOfDayPeriod ?? 'Time of day'} (${estimate.timeOfDayMultiplier}×)`,
      value: 'included',
      accent: estimate.timeOfDayMultiplier > 1,
      muted: estimate.timeOfDayMultiplier <= 1,
    });
  }

  if (estimate.weatherMultiplier && estimate.weatherMultiplier > 1) {
    items.push({
      icon: <CloudRain className="h-3.5 w-3.5" />,
      label: `Weather (${estimate.weatherCondition?.toLowerCase() ?? 'rain'}) — ${estimate.weatherMultiplier}×`,
      value: 'included',
      accent: true,
    });
  }

  if (estimate.crossZoneMultiplier && estimate.crossZoneMultiplier > 1) {
    items.push({
      icon: <MapPinned className="h-3.5 w-3.5" />,
      label: `Cross-zone delivery (${estimate.crossZoneMultiplier}×)`,
      value: 'included',
      accent: true,
    });
  }

  if (estimate.isExpress && estimate.expressMultiplier && estimate.expressMultiplier > 1) {
    items.push({
      icon: <Zap className="h-3.5 w-3.5" />,
      label: `Express delivery (${estimate.expressMultiplier}×)`,
      value: 'included',
      accent: true,
    });
  }

  if (estimate.expressIgnored) {
    items.push({
      icon: <Zap className="h-3.5 w-3.5" />,
      label: 'Express not available for this distance',
      value: 'n/a',
      muted: true,
    });
  }

  if (estimate.scheduleDiscount < 1) {
    const pct = Math.round((1 - estimate.scheduleDiscount) * 100);
    items.push({
      icon: <Calendar className="h-3.5 w-3.5" />,
      label: `Schedule discount (${pct}%)`,
      value: `−${pct}%`,
      discount: true,
    });
  }

  if (estimate.scheduleDiscountBlockedBySurge) {
    items.push({
      icon: <Calendar className="h-3.5 w-3.5" />,
      label: 'Schedule discount unavailable during high demand',
      value: 'n/a',
      muted: true,
    });
  }

  if (estimate.businessDiscount && estimate.businessDiscount > 0) {
    const pct = Math.round(estimate.businessDiscount * 100);
    items.push({
      icon: <Building2 className="h-3.5 w-3.5" />,
      label: `Business discount (${pct}%)`,
      value: `−${pct}%`,
      discount: true,
    });
  }

  if (estimate.promoDiscount && estimate.promoDiscount > 0) {
    items.push({
      icon: <Tag className="h-3.5 w-3.5" />,
      label: 'Promo discount',
      value: `−${formatCurrency(estimate.promoDiscount, estimate.currency)}`,
      discount: true,
    });
  }

  return (
    <div className="space-y-1">
      {/* Line items */}
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className={`flex items-center gap-2 ${
              item.discount ? 'text-green-600' :
              item.accent ? 'text-brand-600' :
              item.muted ? 'text-surface-400' :
              'text-surface-600'
            }`}>
              {item.icon}
              <span className="capitalize">{item.label}</span>
            </div>
            <span className={`font-medium ${
              item.discount ? 'text-green-600' :
              item.accent ? 'text-brand-600' :
              item.muted ? 'text-surface-400 text-xs' :
              'text-surface-700'
            }`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Subtotal & service fee */}
      <div className="border-t border-surface-100 pt-2.5 mt-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-sm text-surface-500">
          <span>Subtotal</span>
          <span>{formatCurrency(estimate.subtotal, estimate.currency)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-surface-500">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" />
            <span>Service fee</span>
          </div>
          <span>{formatCurrency(estimate.serviceFee, estimate.currency)}</span>
        </div>
      </div>

      {/* Total */}
      <div className="border-t border-surface-200 pt-2.5 mt-1 flex items-center justify-between">
        <span className="text-sm font-bold text-surface-900">Total</span>
        <span className="text-lg font-bold text-surface-900">
          {formatCurrency(estimate.totalPrice, estimate.currency)}
        </span>
      </div>

      {/* Trip info pills */}
      <div className="flex items-center gap-2 pt-1.5 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-100 text-xs text-surface-500">
          <Route className="h-3 w-3" /> {fmtKm(estimate.distanceKm)}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-100 text-xs text-surface-500">
          <Clock className="h-3 w-3" /> ~{fmtMin(estimate.estimatedDurationMinutes)}
        </span>
        {estimate.isExpress && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-xs text-brand-700 font-semibold">
            <Zap className="h-3 w-3" /> Express
          </span>
        )}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-xs text-brand-600">
          <Bike className="h-3 w-3" /> Rider earns {formatCurrency(estimate.riderEarnings, estimate.currency)}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────

export function PriceBreakdown({ estimate, variant = 'compact', className = '' }: PriceBreakdownProps) {
  if (variant === 'compact') {
    return (
      <div className={className}>
        <CompactBreakdown estimate={estimate} />
      </div>
    );
  }

  return (
    <div className={className}>
      <ExpandedBreakdown estimate={estimate} />
    </div>
  );
}
