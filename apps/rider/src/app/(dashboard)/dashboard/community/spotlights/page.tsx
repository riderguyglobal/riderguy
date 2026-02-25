'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRiderIdentity } from '@/hooks/use-rider-identity';
import type { Spotlight } from '@/hooks/use-rider-identity';
import {
  ArrowLeft,
  Trophy,
  Star,
  ChevronRight,
  Loader2,
} from 'lucide-react';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Rookie', 2: 'Runner', 3: 'Streaker', 4: 'Pro', 5: 'Ace', 6: 'Captain', 7: 'Legend',
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function SpotlightsPage() {
  const { spotlights, latestSpotlight, loading, fetchSpotlights, fetchLatestSpotlight } =
    useRiderIdentity();

  useEffect(() => {
    fetchLatestSpotlight();
    fetchSpotlights();
  }, [fetchLatestSpotlight, fetchSpotlights]);

  return (
    <div className="min-h-[100dvh] bg-[#0a0e17]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#0a0e17]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <Link href="/dashboard/community" className="p-2 -ml-2 text-surface-400 hover:text-surface-200">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold text-white">Rider Spotlight</h1>
            <div className="w-9" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading && !latestSpotlight ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
          </div>
        ) : !latestSpotlight && spotlights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
              <Trophy className="h-8 w-8 text-amber-400" />
            </div>
            <h3 className="text-white font-semibold mb-1">No spotlights yet</h3>
            <p className="text-surface-400 text-sm max-w-[260px]">
              Rider of the Month spotlights will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Featured spotlight */}
            {latestSpotlight && (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className="h-5 w-5 text-amber-400" />
                  <span className="text-amber-400 text-xs font-bold uppercase tracking-wide">
                    Rider of the Month
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <div className="h-14 w-14 rounded-2xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                    {latestSpotlight.rider.user.avatar ? (
                      <img
                        src={latestSpotlight.rider.user.avatar}
                        alt=""
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                    ) : (
                      <span className="text-amber-400 text-xl font-bold">
                        {latestSpotlight.rider.user.firstName.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-white text-lg font-bold">
                      {latestSpotlight.rider.user.firstName} {latestSpotlight.rider.user.lastName}
                    </h2>
                    <p className="text-surface-300 text-xs">
                      Level {latestSpotlight.rider.currentLevel} —{' '}
                      {LEVEL_NAMES[latestSpotlight.rider.currentLevel]}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-surface-400 mt-0.5">
                      <span>{latestSpotlight.rider.totalDeliveries} deliveries</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 text-amber-400" />
                        {latestSpotlight.rider.averageRating.toFixed(1)}
                      </span>
                      {latestSpotlight.rider.currentZone && (
                        <>
                          <span>•</span>
                          <span>{latestSpotlight.rider.currentZone.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <h3 className="text-white font-semibold text-sm mb-2">{latestSpotlight.title}</h3>
                <p className="text-surface-200 text-sm leading-relaxed whitespace-pre-wrap">
                  {latestSpotlight.story}
                </p>

                <p className="text-amber-500/60 text-[10px] mt-3">
                  {MONTH_NAMES[latestSpotlight.month]} {latestSpotlight.year}
                </p>
              </div>
            )}

            {/* Past spotlights */}
            {spotlights.length > 1 && (
              <div>
                <h2 className="text-white font-semibold mb-3">Past Spotlights</h2>
                <div className="space-y-2">
                  {spotlights
                    .filter((s) => s.id !== latestSpotlight?.id)
                    .map((s) => (
                      <SpotlightCard key={s.id} spotlight={s} />
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SpotlightCard({ spotlight }: { spotlight: Spotlight }) {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          {spotlight.rider.user.avatar ? (
            <img src={spotlight.rider.user.avatar} alt="" className="h-11 w-11 rounded-xl object-cover" />
          ) : (
            <span className="text-amber-400 font-bold">{spotlight.rider.user.firstName.charAt(0)}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm truncate">
            {spotlight.rider.user.firstName} {spotlight.rider.user.lastName}
          </h3>
          <p className="text-surface-400 text-xs">{spotlight.title}</p>
          <p className="text-surface-500 text-[10px] mt-0.5">
            {MONTH_NAMES[spotlight.month]} {spotlight.year}
          </p>
        </div>
        <Trophy className="h-4 w-4 text-amber-400/60 flex-shrink-0" />
      </div>
      <p className="text-surface-300 text-xs mt-2 line-clamp-2 leading-relaxed">{spotlight.story}</p>
    </div>
  );
}
