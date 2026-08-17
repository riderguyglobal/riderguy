'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Star,
  Package,
  Award,
  Zap,
  Heart,
  MapPin,
  Clock,
  ChevronRight,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────

interface NearbyRider {
  id: string;
  riderProfileId: string;
  averageRating: number | null;
  totalDeliveries: number;
  currentLevel: number;
  distanceKm: number;
  etaMinutes: number;
  isOnline: boolean;
  user: {
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}

interface FavoriteRider {
  id: string;
  riderProfileId: string;
  createdAt: string;
  riderProfile: {
    id: string;
    averageRating: number | null;
    totalDeliveries: number;
    currentLevel: number;
    user: {
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  };
}

// ── Constants ──────────────────────────────────────────

const LEVEL_NAMES: Record<number, string> = {
  1: 'Rookie', 2: 'Explorer', 3: 'Hustler',
  4: 'Pro', 5: 'Elite', 6: 'Champion', 7: 'Legend',
};

const LEVEL_COLORS: Record<number, string> = {
  1: '#6B7280', 2: '#3B82F6', 3: '#8B5CF6',
  4: '#F59E0B', 5: '#EF4444', 6: '#EC4899', 7: '#F97316',
};

// ── Genius Spark Icon ──────────────────────────────────

function GeniusSparkIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <defs>
        <linearGradient id="sparkGrad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#0AB957" />
        </linearGradient>
        <radialGradient id="sparkGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0AB957" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0AB957" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill="url(#sparkGlow)" />
      <circle cx="24" cy="24" r="16" fill="#EEF9F2" />
      <path
        d="M26 12H19L16 24H22L19 36L32 22H26V12Z"
        fill="url(#sparkGrad)"
        stroke="#0AB957"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Rider Avatar ───────────────────────────────────────

function RiderAvatar({
  avatarUrl,
  firstName,
  lastName,
  size = 'md',
  isOnline,
}: {
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
}) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const sizeClasses = {
    sm:  'h-10 w-10 rounded-xl text-[13px]',
    md:  'h-12 w-12 rounded-2xl text-[15px]',
    lg:  'h-14 w-14 rounded-2xl text-[17px]',
  };
  return (
    <div className={`relative flex-shrink-0 ${sizeClasses[size]} bg-[#EEF9F2] overflow-hidden flex items-center justify-center`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={firstName} className="h-full w-full object-cover" />
      ) : (
        <span className={`font-bold text-[#0AB957] ${sizeClasses[size].split(' ').slice(-1)[0]}`}>
          {initials}
        </span>
      )}
      {isOnline !== undefined && (
        <span
          className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
            isOnline ? 'bg-[#0AB957]' : 'bg-gray-300'
          }`}
        />
      )}
    </div>
  );
}

// ── Rider Stats Row ────────────────────────────────────

function RiderStats({
  rating,
  deliveries,
  level,
}: {
  rating: number | null;
  deliveries: number;
  level: number;
}) {
  return (
    <div className="flex items-center gap-3 mt-1">
      <span className="flex items-center gap-1 text-[12px] text-gray-500">
        <Star className="h-3 w-3 text-amber-400 fill-amber-400 flex-shrink-0" />
        {rating != null ? Number(rating).toFixed(1) : '—'}
      </span>
      <span className="flex items-center gap-1 text-[12px] text-gray-500">
        <Package className="h-3 w-3 flex-shrink-0" />
        {deliveries.toLocaleString()}
      </span>
      <span
        className="flex items-center gap-1 text-[11px] font-semibold"
        style={{ color: LEVEL_COLORS[level] ?? '#6B7280' }}
      >
        <Award className="h-3 w-3 flex-shrink-0" />
        {LEVEL_NAMES[level] ?? `Lv.${level}`}
      </span>
    </div>
  );
}

// ── How It Works Card ──────────────────────────────────

function HowCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 items-start">
      <div className="h-9 w-9 rounded-xl bg-[#EEF9F2] flex items-center justify-center flex-shrink-0 text-[#0AB957]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-900">{title}</p>
        <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{body}</p>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────

export default function RiderGeniusPage() {
  const router      = useRouter();
  const { api }     = useAuth();

  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating,   setLocating]   = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Get user location once on mount
  const detectLocation = useCallback(() => {
    setLocating(true);
    if (!navigator.geolocation) { setLocating(false); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => { detectLocation(); }, [detectLocation]);

  // ── Nearby riders ──────────────────────────────
  const {
    data: nearbyRiders,
    isLoading: nearbyLoading,
    refetch: refetchNearby,
    isRefetching: nearbyRefetching,
  } = useQuery<NearbyRider[]>({
    queryKey: ['riders-nearby', userCoords?.lat, userCoords?.lng],
    queryFn: async () => {
      const res = await api!.get('/riders/nearby', {
        params: { lat: userCoords!.lat, lng: userCoords!.lng, radius: 10 },
      });
      return (res.data.data ?? []) as NearbyRider[];
    },
    enabled: !!api && !!userCoords,
    staleTime: 60_000,
  });

  // ── Favorite riders ────────────────────────────
  const { data: favorites, isLoading: favsLoading } = useQuery<FavoriteRider[]>({
    queryKey: ['favorite-riders'],
    queryFn: async () => {
      const res = await api!.get('/favorite-riders');
      return (res.data.data ?? []) as FavoriteRider[];
    },
    enabled: !!api,
  });

  const handleBook = (riderProfileId: string) => {
    router.push(`/dashboard/send?riderId=${riderProfileId}`);
  };

  const handleAutoMatch = () => {
    router.push('/dashboard/send');
  };

  const isLoading = locating || nearbyLoading || favsLoading;

  return (
    <div className="min-h-[100dvh] bg-[#F4F4F4] animate-page-enter">

      {/* ── Header ─────────────────────────────────── */}
      <div
        className="bg-white sticky top-0 z-20 flex items-center gap-3 px-4 border-b border-black/[0.05]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="h-9 w-9 rounded-xl bg-[#F4F4F4] flex items-center justify-center">
          <ArrowLeft className="h-5 w-5 text-gray-900" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <GeniusSparkIcon className="h-6 w-6" />
          <p className="text-[17px] font-black text-gray-900">Rider Genius</p>
        </div>
        <button
          onClick={() => refetchNearby()}
          disabled={nearbyRefetching}
          className="h-9 w-9 rounded-xl bg-[#F4F4F4] flex items-center justify-center active:bg-gray-200 transition-colors"
          aria-label="Refresh riders"
        >
          <RefreshCw className={`h-4 w-4 text-gray-600 ${nearbyRefetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-4 pb-10 pt-4 space-y-4">

        {/* ── Hero ────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0AB957] to-[#07994A] px-5 py-5">
          {/* decorative circles */}
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.07]" />
          <div className="absolute -right-2 bottom-0 h-16 w-16 rounded-full bg-white/[0.05]" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-white/90" />
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">Smart Matching</span>
            </div>
            <h2 className="text-[20px] font-black text-white leading-tight">
              Find Your Perfect Rider
            </h2>
            <p className="text-[12px] text-white/75 mt-1 leading-snug max-w-[230px]">
              Rider Genius uses ratings, proximity, and delivery history to match you with the best available rider.
            </p>
            <button
              onClick={handleAutoMatch}
              className="mt-4 flex items-center gap-2 rounded-[10px] bg-white px-4 py-2.5 text-[13px] font-bold text-[#0AB957] active:scale-95 transition-transform"
            >
              <Zap className="h-3.5 w-3.5" />
              Auto-Match Me Now
            </button>
          </div>
        </div>

        {/* ── How It Works ───────────────────────────── */}
        <div className="bg-white rounded-[20px] px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">How It Works</p>
          <div className="space-y-4">
            <HowCard
              icon={<MapPin className="h-4 w-4" />}
              title="Proximity Matching"
              body="We find riders within 10 km of your pickup location and sort by ETA."
            />
            <HowCard
              icon={<Star className="h-4 w-4" />}
              title="Rating Priority"
              body="Riders with higher ratings and more deliveries are promoted to the top of your match list."
            />
            <HowCard
              icon={<Heart className="h-4 w-4" />}
              title="Favourites First"
              body="Your favourite riders always get priority when they are available near you."
            />
            <HowCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Verified Riders Only"
              body="Every rider is ID-verified, background-checked, and trained before joining our platform."
            />
          </div>
        </div>

        {/* ── Favourite Riders ───────────────────────── */}
        {(favsLoading || (favorites && favorites.length > 0)) && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-[15px] font-black text-gray-900 flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-rose-400 fill-rose-400" />
                Your Favourites
              </h2>
              <button
                onClick={() => router.push('/dashboard/favorite-riders')}
                className="text-[12px] font-semibold text-[#0AB957] flex items-center gap-0.5"
              >
                Manage <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {favsLoading ? (
              <div className="space-y-2.5">
                {[0, 1].map(i => (
                  <div key={i} className="h-[76px] animate-pulse rounded-[16px] bg-white" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {(favorites ?? []).map(fav => {
                  const r  = fav.riderProfile;
                  const u  = r.user;
                  const isSelected = selectedId === r.id;
                  return (
                    <button
                      key={fav.id}
                      onClick={() => setSelectedId(isSelected ? null : r.id)}
                      className={[
                        'w-full flex items-center gap-3 rounded-[16px] bg-white px-4 py-3.5 text-left',
                        'shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all active:scale-[0.98]',
                        isSelected ? 'ring-2 ring-[#0AB957]' : '',
                      ].join(' ')}
                    >
                      <RiderAvatar
                        avatarUrl={u.avatarUrl}
                        firstName={u.firstName}
                        lastName={u.lastName}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-gray-900 truncate">
                          {u.firstName} {u.lastName}
                        </p>
                        <RiderStats rating={r.averageRating} deliveries={r.totalDeliveries} level={r.currentLevel} />
                      </div>
                      {isSelected ? (
                        <button
                          onClick={e => { e.stopPropagation(); handleBook(r.id); }}
                          className="flex-shrink-0 h-8 rounded-lg bg-[#0AB957] px-3 text-[12px] font-bold text-white active:bg-[#089948]"
                        >
                          Book
                        </button>
                      ) : (
                        <Heart className="h-4 w-4 text-rose-400 fill-rose-400 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── Nearby Riders ──────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[15px] font-black text-gray-900 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#0AB957]" />
              Nearby Riders
            </h2>
            {userCoords && (
              <span className="text-[11px] text-gray-400">Within 10 km</span>
            )}
          </div>

          {/* Locating state */}
          {locating && (
            <div className="bg-white rounded-[16px] py-6 flex flex-col items-center gap-2 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
              <Loader2 className="h-5 w-5 text-[#0AB957] animate-spin" />
              <p className="text-[13px] text-gray-500">Detecting your location…</p>
            </div>
          )}

          {/* No location */}
          {!locating && !userCoords && (
            <div className="bg-white rounded-[16px] py-8 flex flex-col items-center gap-3 shadow-[0_2px_10px_rgba(0,0,0,0.05)] px-5 text-center">
              <MapPin className="h-8 w-8 text-gray-200" />
              <p className="text-[14px] font-bold text-gray-700">Location access needed</p>
              <p className="text-[12px] text-gray-400">
                Allow location access so we can find riders near you.
              </p>
              <button
                onClick={detectLocation}
                className="mt-1 h-9 rounded-xl bg-[#0AB957] px-5 text-[13px] font-bold text-white active:bg-[#089948]"
              >
                Enable Location
              </button>
            </div>
          )}

          {/* Loading riders */}
          {!locating && userCoords && nearbyLoading && (
            <div className="space-y-2.5">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-[80px] animate-pulse rounded-[16px] bg-white" />
              ))}
            </div>
          )}

          {/* No riders found */}
          {!locating && userCoords && !nearbyLoading && (nearbyRiders?.length ?? 0) === 0 && (
            <div className="bg-white rounded-[16px] py-10 flex flex-col items-center gap-2 shadow-[0_2px_10px_rgba(0,0,0,0.05)] px-5 text-center">
              <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-1">
                <GeniusSparkIcon className="h-8 w-8 opacity-40" />
              </div>
              <p className="text-[14px] font-bold text-gray-700">No riders nearby right now</p>
              <p className="text-[12px] text-gray-400">
                Place your order anyway — we&apos;ll find the best available rider for you.
              </p>
              <button
                onClick={handleAutoMatch}
                className="mt-2 h-9 rounded-xl bg-[#0AB957] px-5 text-[13px] font-bold text-white active:bg-[#089948]"
              >
                Book Anyway
              </button>
            </div>
          )}

          {/* Riders list */}
          {!locating && !nearbyLoading && (nearbyRiders?.length ?? 0) > 0 && (
            <div className="space-y-2.5">
              {(nearbyRiders ?? []).map((rider, idx) => {
                const isSelected = selectedId === rider.riderProfileId;
                const isTop      = idx === 0 && (rider.averageRating ?? 0) >= 4.5;
                return (
                  <button
                    key={rider.id}
                    onClick={() => setSelectedId(isSelected ? null : rider.riderProfileId)}
                    className={[
                      'w-full flex items-center gap-3 rounded-[16px] bg-white px-4 py-3.5 text-left',
                      'shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all active:scale-[0.98]',
                      isSelected ? 'ring-2 ring-[#0AB957]' : '',
                    ].join(' ')}
                  >
                    <RiderAvatar
                      avatarUrl={rider.user.avatarUrl}
                      firstName={rider.user.firstName}
                      lastName={rider.user.lastName}
                      size="md"
                      isOnline={rider.isOnline}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-bold text-gray-900 truncate">
                          {rider.user.firstName} {rider.user.lastName}
                        </p>
                        {isTop && (
                          <span className="flex-shrink-0 h-4 px-1.5 rounded-full bg-amber-50 text-amber-600 text-[9px] font-bold flex items-center">
                            TOP
                          </span>
                        )}
                      </div>
                      <RiderStats
                        rating={rider.averageRating}
                        deliveries={rider.totalDeliveries}
                        level={rider.currentLevel}
                      />
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {isSelected ? (
                        <button
                          onClick={e => { e.stopPropagation(); handleBook(rider.riderProfileId); }}
                          className="h-8 rounded-lg bg-[#0AB957] px-3 text-[12px] font-bold text-white active:bg-[#089948]"
                        >
                          Book
                        </button>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-[#0AB957]">
                            <Clock className="h-3 w-3" />
                            {rider.etaMinutes} min
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {rider.distanceKm < 1
                              ? `${Math.round(rider.distanceKm * 1000)} m`
                              : `${rider.distanceKm.toFixed(1)} km`}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── CTA ─────────────────────────────────────── */}
        <div className="bg-white rounded-[20px] px-4 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#EEF9F2] flex items-center justify-center flex-shrink-0">
            <Zap className="h-5 w-5 text-[#0AB957]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-900">Let Genius Decide</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Trust our algorithm to pick the fastest, highest-rated rider for you.
            </p>
          </div>
          <button
            onClick={handleAutoMatch}
            className="flex-shrink-0 h-9 rounded-xl bg-[#0AB957] px-4 text-[12px] font-bold text-white active:bg-[#089948] transition-colors"
          >
            Go
          </button>
        </div>

      </div>
    </div>
  );
}
