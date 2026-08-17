'use client';

import { useAuth } from '@riderguy/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@riderguy/ui';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, HeartOff, Star, Package, Award, Loader2 } from 'lucide-react';

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

const LEVEL_NAMES: Record<number, string> = {
  1: 'Rookie', 2: 'Explorer', 3: 'Hustler',
  4: 'Pro', 5: 'Elite', 6: 'Champion', 7: 'Legend',
};

export default function FavoriteRidersPage() {
  const router      = useRouter();
  const { api }     = useAuth();
  const queryClient = useQueryClient();

  const { data: favorites, isLoading } = useQuery({
    queryKey: ['favorite-riders'],
    queryFn: async () => {
      const res = await api!.get('/favorite-riders');
      return (res.data.data ?? []) as FavoriteRider[];
    },
    enabled: !!api,
  });

  const removeMutation = useMutation({
    mutationFn: (riderProfileId: string) => api!.delete(`/favorite-riders/${riderProfileId}`),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['favorite-riders'] }),
  });

  const count = favorites?.length ?? 0;

  return (
    <div className="min-h-[100dvh] bg-surface-50 animate-page-enter">

      {/* ── Header ───────────────────────────────── */}
      <div
        className="bg-surface-50 sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 12px)', paddingBottom: 14 }}
      >
        <button onClick={() => router.back()} className="map-btn bg-white shadow-card">
          <ArrowLeft className="h-5 w-5 text-surface-900" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <p className="text-[17px] font-bold text-surface-900">Favourite Riders</p>
          {count > 0 && (
            <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
              {count}
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pb-10">

        {/* ── Loading ──────────────────────────────── */}
        {isLoading && (
          <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-surface-50">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-4">
                <Skeleton className="h-12 w-12 rounded-2xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-28 rounded" />
                  <Skeleton className="h-3 w-44 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Empty ────────────────────────────────── */}
        {!isLoading && count === 0 && (
          <div className="bg-white rounded-2xl shadow-card py-14 flex flex-col items-center text-center px-8">
            <div className="h-16 w-16 rounded-2xl bg-rose-50 flex items-center justify-center mb-3">
              <Heart className="h-7 w-7 text-rose-300" />
            </div>
            <p className="text-[15px] font-bold text-surface-700">No favourite riders yet</p>
            <p className="text-[13px] text-surface-400 mt-1 leading-snug">
              After a delivery, you can add riders you loved to your favourites — they'll get priority on future orders!
            </p>
          </div>
        )}

        {/* ── List ─────────────────────────────────── */}
        {!isLoading && count > 0 && (
          <>
            <div className="bg-white rounded-2xl shadow-card overflow-hidden divide-y divide-surface-50">
              {(favorites ?? []).map(fav => {
                const rider    = fav.riderProfile;
                const user     = rider.user;
                const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
                const rating   = rider.averageRating != null
                  ? Number(rider.averageRating).toFixed(1)
                  : '—';

                return (
                  <div key={fav.id} className="flex items-center gap-3 px-4 py-4">
                    {/* Avatar */}
                    <div className="h-12 w-12 rounded-2xl bg-surface-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatarUrl} alt={user.firstName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-[15px] font-bold text-surface-600">{initials}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-surface-900 truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[12px] text-surface-500">
                          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                          {rating}
                        </span>
                        <span className="flex items-center gap-1 text-[12px] text-surface-500">
                          <Package className="h-3 w-3" />
                          {rider.totalDeliveries}
                        </span>
                        <span className="flex items-center gap-1 text-[12px] text-surface-500">
                          <Award className="h-3 w-3 text-brand-500" />
                          Lv.{rider.currentLevel} {LEVEL_NAMES[rider.currentLevel] ?? ''}
                        </span>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeMutation.mutate(rider.id)}
                      disabled={removeMutation.isPending}
                      className="h-9 w-9 rounded-xl flex items-center justify-center text-rose-400 active:bg-rose-50 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      {removeMutation.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <HeartOff className="h-4 w-4" />
                      }
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-[12px] text-surface-400 mt-5 px-8">
              Your favourite riders get priority when we match delivery orders.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
