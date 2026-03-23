'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRiderIdentity } from '@/hooks/use-rider-identity';
import {
  ArrowLeft,
  User,
  Edit3,
  Star,
  Award,
  Truck,
  Clock,
  CheckCircle,
  Share2,
  Copy,
  Loader2,
  ExternalLink,
} from 'lucide-react';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Rookie',
  2: 'Runner',
  3: 'Streaker',
  4: 'Pro',
  5: 'Ace',
  6: 'Captain',
  7: 'Legend',
};

const LEVEL_COLORS: Record<number, string> = {
  1: 'text-muted',
  2: 'text-emerald-400',
  3: 'text-blue-400',
  4: 'text-purple-400',
  5: 'text-amber-400',
  6: 'text-orange-400',
  7: 'text-red-400',
};

export default function RiderProfilePage() {
  const { identity, loading, fetchMyIdentity, updateIdentity } = useRiderIdentity();
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchMyIdentity();
  }, [fetchMyIdentity]);

  useEffect(() => {
    if (identity) {
      setBio(identity.bio || '');
      setSlug(identity.publicProfileUrl || '');
    }
  }, [identity]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateIdentity({
        bio: bio || undefined,
        publicProfileUrl: slug || undefined,
      });
      setEditing(false);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = () => {
    if (identity?.publicProfileUrl) {
      try {
        navigator.clipboard.writeText(
          `${window.location.origin}/rider/${identity.publicProfileUrl}`,
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard API may not be available
      }
    }
  };

  if (loading && !identity) {
    return (
      <div className="min-h-[100dvh] bg-page flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="min-h-[100dvh] bg-page flex flex-col items-center justify-center">
        <p className="text-muted text-sm">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-page">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-nav backdrop-blur-xl border-b border-themed">
        <div className="px-4 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between h-14">
            <Link href="/dashboard/community" className="p-2 -ml-2 text-muted hover:text-secondary">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-semibold text-primary">My Profile</h1>
            <button
              onClick={() => setEditing(!editing)}
              className="p-2 -mr-2 text-brand-400 hover:text-brand-300"
            >
              <Edit3 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Profile Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-brand-500/10 to-purple-500/10 border border-themed">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-16 w-16 rounded-2xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              {identity.user.avatarUrl ? (
                <img src={identity.user.avatarUrl} alt="" className="h-16 w-16 rounded-2xl object-cover" />
              ) : (
                <span className="text-brand-400 text-2xl font-bold">
                  {identity.user.firstName?.charAt(0) || '?'}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-primary text-lg font-bold">
                {identity.user.firstName} {identity.user.lastName}
              </h2>
              <p className={`text-sm font-semibold ${LEVEL_COLORS[identity.currentLevel] || 'text-muted'}`}>
                Level {identity.currentLevel} — {LEVEL_NAMES[identity.currentLevel] || 'Rider'}
              </p>
              {identity.currentZone && (
                <p className="text-muted text-xs mt-0.5">{identity.currentZone.name}</p>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-primary text-lg font-bold">{identity.totalDeliveries}</p>
              <p className="text-muted text-[10px]">Deliveries</p>
            </div>
            <div className="text-center">
              <p className="text-primary text-lg font-bold flex items-center justify-center gap-1">
                <Star className="h-4 w-4 text-amber-400" />
                {identity.averageRating.toFixed(1)}
              </p>
              <p className="text-muted text-[10px]">{identity.totalRatings} ratings</p>
            </div>
            <div className="text-center">
              <p className="text-primary text-lg font-bold">{Math.round(identity.completionRate)}%</p>
              <p className="text-muted text-[10px]">Completion</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-secondary text-xs font-medium mb-1.5 block">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Tell other riders about yourself..."
                className="w-full bg-card border border-themed-strong rounded-xl px-4 py-3 text-primary text-sm placeholder:text-subtle outline-none focus:border-brand-500/50 resize-none"
              />
              <p className="text-subtle text-[10px] text-right mt-1">{bio.length}/500</p>
            </div>
            <div>
              <label className="text-secondary text-xs font-medium mb-1.5 block">
                Public Profile URL
              </label>
              <div className="flex items-center gap-2">
                <span className="text-subtle text-sm shrink-0">myriderguy.com/rider/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="your-name"
                  maxLength={40}
                  className="flex-1 bg-card border border-themed-strong rounded-xl px-3 py-2.5 text-primary text-sm placeholder:text-subtle outline-none focus:border-brand-500/50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 text-white font-medium text-sm shadow-lg shadow-brand-500/20 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 rounded-xl bg-card text-secondary font-medium text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {identity.bio && (
              <div className="p-4 rounded-2xl bg-hover-themed border border-themed">
                <p className="text-secondary text-sm leading-relaxed">{identity.bio}</p>
              </div>
            )}

            {/* Public link */}
            {identity.publicProfileUrl && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-hover-themed border border-themed">
                <div className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4 text-brand-400" />
                  <span className="text-secondary text-xs">
                    myriderguy.com/rider/{identity.publicProfileUrl}
                  </span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="text-brand-400 text-xs font-medium flex items-center gap-1"
                >
                  {copied ? <CheckCircle className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
          </>
        )}

        {/* Badges */}
        {identity.badges.length > 0 && (
          <div>
            <h2 className="text-primary font-semibold mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-brand-400" />
              Badges
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {identity.badges.map((b) => (
                <div
                  key={b.badge.name}
                  className="p-3 rounded-xl bg-hover-themed border border-themed flex items-center gap-2.5"
                >
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    {b.badge.icon ? (
                      <span className="text-xl">{b.badge.icon}</span>
                    ) : (
                      <Award className="h-5 w-5 text-amber-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-primary text-xs font-semibold truncate">{b.badge.name}</p>
                    <p className="text-muted text-[10px] truncate">{b.badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-hover-themed border border-themed text-center">
            <Clock className="h-5 w-5 text-brand-400 mx-auto mb-1" />
            <p className="text-primary text-lg font-bold">{Math.round(identity.onTimeRate)}%</p>
            <p className="text-muted text-[10px]">On-Time Rate</p>
          </div>
          <div className="p-4 rounded-2xl bg-hover-themed border border-themed text-center">
            <Truck className="h-5 w-5 text-brand-400 mx-auto mb-1" />
            <p className="text-primary text-lg font-bold">
              {new Date(identity.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
            </p>
            <p className="text-muted text-[10px]">Member Since</p>
          </div>
        </div>
      </div>
    </div>
  );
}
