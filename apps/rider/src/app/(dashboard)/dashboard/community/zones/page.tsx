'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@riderguy/auth';
import { API_BASE_URL } from '@/lib/constants';
import { useCommunityChat } from '@/hooks/use-community';
import type { ZoneRoom } from '@/hooks/use-community';
import { ArrowLeft, Users, MapPin, Check } from 'lucide-react';

export default function ZoneRoomsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const { joinZoneRoom } = useCommunityChat();
  const [zones, setZones] = useState<ZoneRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API_BASE_URL}/community/chat/zones`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(json => {
        if (json.success) setZones(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleJoin = useCallback(async (zone: ZoneRoom) => {
    if (!zone.zoneId) return;
    setJoining(zone.id);
    try {
      const roomId = await joinZoneRoom(zone.zoneId);
      if (roomId) {
        router.push(`/dashboard/community/chat/${roomId}`);
      }
    } catch (err) {
      console.error('Failed to join zone:', err);
    } finally {
      setJoining(null);
    }
  }, [joinZoneRoom, router]);

  return (
    <div className="min-h-[100dvh] bg-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-nav backdrop-blur-xl border-b border-themed">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-muted hover:text-secondary">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-primary">Zone Rooms</h1>
            <div className="w-9" />
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        <p className="text-muted text-sm">
          Join a zone chat to connect with riders in your area.
        </p>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
          </div>
        ) : zones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MapPin className="h-8 w-8 text-subtle mb-3" />
            <p className="text-muted text-sm">No zone rooms available yet</p>
          </div>
        ) : (
          zones.map(zone => (
            <div key={zone.id} className="flex items-center gap-3 p-4 rounded-2xl bg-hover-themed border border-themed">
              <div className="h-12 w-12 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-primary font-semibold text-sm">{zone.name}</h3>
                {zone.description && (
                  <p className="text-muted text-xs mt-0.5 line-clamp-1">{zone.description}</p>
                )}
                <p className="text-subtle text-[10px] mt-1 flex items-center gap-1">
                  <Users className="h-3 w-3" /> {zone.memberCount} members
                </p>
              </div>
              {zone.isMember ? (
                <div className="px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium flex items-center gap-1">
                  <Check className="h-3 w-3" /> Joined
                </div>
              ) : (
                <button
                  onClick={() => handleJoin(zone)}
                  disabled={joining === zone.id}
                  className="px-4 py-1.5 rounded-full bg-brand-500 text-white text-xs font-medium shadow-lg shadow-brand-500/30 disabled:opacity-50"
                >
                  {joining === zone.id ? 'Joining...' : 'Join'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
