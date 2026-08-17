'use client';

import { Star, Phone, MessageCircle } from 'lucide-react';

export interface RiderInfo {
  id: string;
  name: string;
  avatarUrl?: string | null;
  rating?: number | null;
  totalDeliveries?: number;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  vehiclePlate?: string | null;
  isOnline?: boolean;
}

interface RiderCardProps {
  rider: RiderInfo;
  onCall?: () => void;
  onChat?: () => void;
  showActions?: boolean;
  compact?: boolean;
  className?: string;
}

export function RiderCard({
  rider,
  onCall,
  onChat,
  showActions = true,
  compact = false,
  className = '',
}: RiderCardProps) {
  const initials = rider.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const rating = rider.rating != null ? Number(rider.rating).toFixed(1) : null;

  const vehicle = [rider.vehicleMake, rider.vehicleModel]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className={`${compact ? 'h-12 w-12' : 'h-14 w-14'} rounded-2xl bg-brand-50 overflow-hidden ring-2 ring-brand-100 flex items-center justify-center`}>
          {rider.avatarUrl
            ? <img src={rider.avatarUrl} alt={rider.name} className="h-full w-full object-cover" />
            : <span className="text-[15px] font-bold text-brand-600">{initials}</span>
          }
        </div>
        {rider.isOnline != null && (
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white
              ${rider.isOnline ? 'bg-brand-500' : 'bg-surface-300'}`}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-bold text-surface-900 leading-tight truncate">
          {rider.name}
        </p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {rating && (
            <span className="flex items-center gap-1 text-[13px] font-semibold text-surface-600">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {rating}
              {rider.totalDeliveries != null && (
                <span className="text-surface-400 font-medium">
                  · {rider.totalDeliveries.toLocaleString()}
                </span>
              )}
            </span>
          )}
          {vehicle && (
            <span className="text-[12px] font-medium text-surface-400 truncate">
              {vehicle}
              {rider.vehiclePlate && (
                <span className="ml-1 text-surface-300">· {rider.vehiclePlate}</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex gap-2 flex-shrink-0">
          {onCall && (
            <button
              onClick={onCall}
              className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-surface-100
                         text-surface-700 text-[13px] font-semibold btn-press hover:bg-surface-200
                         transition-colors"
              aria-label="Call rider"
            >
              <Phone className="w-4 h-4" />
              Call
            </button>
          )}
          {onChat && (
            <button
              onClick={onChat}
              className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-surface-100
                         text-surface-700 text-[13px] font-semibold btn-press hover:bg-surface-200
                         transition-colors"
              aria-label="Chat with rider"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}
