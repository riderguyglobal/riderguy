'use client';

import { useAuth } from '@riderguy/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Skeleton, Avatar, AvatarImage, AvatarFallback } from '@riderguy/ui';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Heart,
  HeartOff,
  Star,
  Package,
  Award,
  Loader2,
} from 'lucide-react';

// ── Types ──

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

// ── Component ──

export default function FavoriteRidersPage() {
  const router = useRouter();
  const { api } = useAuth();
  const queryClient = useQueryClient();

  // ── Query ──

  const { data: favorites, isLoading } = useQuery({
    queryKey: ['favorite-riders'],
    queryFn: async () => {
      const res = await api!.get('/favorite-riders');
      return (res.data.data ?? []) as FavoriteRider[];
    },
    enabled: !!api,
  });

  // ── Remove mutation ──

  const removeMutation = useMutation({
    mutationFn: async (riderProfileId: string) => {
      await api!.delete(`/favorite-riders/${riderProfileId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-riders'] });
    },
  });

  const levelNames: Record<number, string> = {
    1: 'Rookie',
    2: 'Explorer',
    3: 'Hustler',
    4: 'Pro',
    5: 'Elite',
    6: 'Champion',
    7: 'Legend',
  };

  return (
    <div className="min-h-[100dvh] bg-white animate-page-enter">
      {/* Header */}
      <div className="safe-area-top bg-white sticky top-0 z-20 border-b border-surface-100">
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <button onClick={() => router.back()} className="p-1 -ml-1">
            <ChevronLeft className="h-5 w-5 text-surface-600" />
          </button>
          <h1 className="text-xl font-bold text-surface-900">Favorite Riders</h1>
          {(favorites ?? []).length > 0 && (
            <span className="bg-red-50 text-red-500 text-xs font-bold px-2 py-0.5 rounded-full">
              {(favorites ?? []).length}
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="px-5 py-3">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3 p-3">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (favorites ?? []).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <Heart className="h-7 w-7 text-red-300" />
            </div>
            <p className="text-surface-500 font-medium">No favorite riders yet</p>
            <p className="text-surface-400 text-sm mt-1 max-w-xs">
              After a delivery, you can add riders you loved to your favorites. They&apos;ll get priority on your future orders!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(favorites ?? []).map((fav) => {
              const rider = fav.riderProfile;
              const user = rider.user;
              const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`;
              const rating = rider.averageRating != null ? Number(rider.averageRating).toFixed(1) : '—';

              return (
                <div
                  key={fav.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100"
                >
                  <Avatar className="h-12 w-12 ring-2 ring-surface-100">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.firstName} />}
                    <AvatarFallback className="bg-brand-100 text-brand-600 font-bold text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-900 truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-surface-500">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        {rating}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-surface-500">
                        <Package className="h-3 w-3" />
                        {rider.totalDeliveries}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-surface-500">
                        <Award className="h-3 w-3 text-brand-500" />
                        Lv.{rider.currentLevel} {levelNames[rider.currentLevel] ?? ''}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => removeMutation.mutate(rider.id)}
                    disabled={removeMutation.isPending}
                    className="p-2 text-red-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Remove from favorites"
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <HeartOff className="h-5 w-5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Tip */}
        {(favorites ?? []).length > 0 && (
          <p className="text-center text-xs text-surface-400 mt-6 px-8">
            Your favorite riders get priority when we match your delivery orders
          </p>
        )}
      </div>
    </div>
  );
}
