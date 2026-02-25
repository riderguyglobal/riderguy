'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Trophy,
  Zap,
  Star,
  Shield,
  Crown,
  Target,
  TrendingUp,
  Medal,
  ChevronRight,
  Users,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useGamification } from '@/hooks/use-gamification';
import { BadgeCelebration } from '@/components/gamification-celebrations';
import { RIDER_LEVEL_NAMES, RIDER_LEVEL_THRESHOLDS } from '@riderguy/types';

// ── Level configuration ──
const LEVEL_GRADIENTS: Record<number, string> = {
  1: 'from-slate-400 to-slate-500',
  2: 'from-emerald-400 to-emerald-600',
  3: 'from-orange-400 to-orange-600',
  4: 'from-blue-400 to-blue-600',
  5: 'from-purple-400 to-purple-600',
  6: 'from-amber-400 to-amber-600',
  7: 'from-rose-400 via-amber-400 to-violet-400',
};

const LEVEL_ICONS = ['🏁', '🏃', '🔥', '⚡', '🎯', '👑', '🌟'];

const LEVEL_PERKS: Record<number, string[]> = {
  1: ['Standard commission rate', 'Access to all zones'],
  2: ['18% commission rate', 'Priority in job queue'],
  3: ['16% commission', 'Streak bonus multiplier'],
  4: ['14% commission', 'Pro badge visible to clients'],
  5: ['12% commission', 'Premium job access'],
  6: ['10% commission', 'Captain perks & mentoring'],
  7: ['8% commission', 'Legend status, max earnings'],
};

const XP_ACTION_LABELS: Record<string, { label: string; icon: string }> = {
  delivery_complete:  { label: 'Delivery Complete', icon: '📦' },
  on_time_delivery:   { label: 'On-Time Delivery',  icon: '⏱️' },
  five_star_rating:   { label: '5-Star Rating',     icon: '⭐' },
  four_star_rating:   { label: '4-Star Rating',     icon: '🌟' },
  referral:           { label: 'Referral Bonus',    icon: '🤝' },
  streak_3:           { label: '3-Day Streak',      icon: '🔥' },
  streak_7:           { label: '7-Day Streak',      icon: '🔥' },
  streak_14:          { label: '14-Day Streak',     icon: '🔥' },
  streak_30:          { label: '30-Day Streak',     icon: '🔥' },
  first_delivery:     { label: 'First Delivery',    icon: '🎉' },
  training_complete:  { label: 'Training Complete',  icon: '📚' },
  perfect_week:       { label: 'Perfect Week',      icon: '💯' },
  bonus:              { label: 'Bonus XP',           icon: '🎁' },
};

const BADGE_CATEGORY_LABELS: Record<string, { label: string; Icon: typeof Trophy }> = {
  milestone:   { label: 'Milestones',   Icon: Target },
  achievement: { label: 'Achievements', Icon: Trophy },
  special:     { label: 'Special',      Icon: Crown },
};

export default function GamificationPage() {
  const {
    profile,
    leaderboard,
    unseenBadges,
    loading,
    error,
    fetchLeaderboard,
    markBadgesSeen,
  } = useGamification();

  const [tab, setTab] = useState<'overview' | 'badges' | 'leaderboard'>('overview');
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

  // Fetch leaderboard when tab switches
  useEffect(() => {
    if (tab === 'leaderboard') fetchLeaderboard();
  }, [tab, fetchLeaderboard]);

  // Show unseen badges celebration
  useEffect(() => {
    if (unseenBadges.length > 0 && !showBadgeCelebration) {
      setShowBadgeCelebration(true);
    }
  }, [unseenBadges.length]);

  const handleBadgeCelebrationDismiss = () => {
    setShowBadgeCelebration(false);
    const ids = unseenBadges.map(b => b.id);
    markBadgesSeen(ids);
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0e17] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0e17] flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-6 text-center max-w-sm">
          <Trophy className="h-8 w-8 text-surface-500 mx-auto mb-3" />
          <p className="text-surface-400 text-sm">{error ?? 'Could not load gamification data'}</p>
          <Link href="/dashboard" className="text-brand-400 text-sm font-medium mt-3 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const earnedBadges = profile.badges.filter(b => b.awardedAt);
  const badgesByCategory = profile.badges.reduce<Record<string, typeof profile.badges>>((acc, b) => {
    const cat = b.category || 'achievement';
    (acc[cat] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="min-h-[100dvh] bg-[#0a0e17]">
      {/* ── Header ── */}
      <header className="relative overflow-hidden">
        {/* Background gradient */}
        <div className={`absolute inset-0 bg-gradient-to-br ${LEVEL_GRADIENTS[profile.currentLevel] ?? LEVEL_GRADIENTS[1]} opacity-20`} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0e17]" />

        <div className="relative px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6">
          {/* Back button */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-surface-400 text-sm font-medium mb-6 btn-press"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>

          {/* Level display */}
          <div className="flex items-center gap-4">
            {/* Level circle */}
            <div className="relative">
              {/* Glow */}
              <div className={`absolute inset-0 bg-gradient-to-br ${LEVEL_GRADIENTS[profile.currentLevel] ?? LEVEL_GRADIENTS[1]} rounded-full blur-xl opacity-40 scale-125`} />

              {/* Ring progress */}
              <div className="relative h-20 w-20">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                  <circle
                    cx="40" cy="40" r="36" fill="none"
                    stroke="url(#levelGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${profile.progressPercent * 2.26} 226`}
                  />
                  <defs>
                    <linearGradient id="levelGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl">{LEVEL_ICONS[profile.currentLevel - 1] ?? '🏁'}</span>
                </div>
              </div>
            </div>

            {/* Level info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-surface-400 text-xs font-medium uppercase tracking-widest">Level {profile.currentLevel}</span>
                {profile.isMaxLevel && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">MAX</span>
                )}
              </div>
              <h1 className={`text-2xl font-black bg-gradient-to-r ${LEVEL_GRADIENTS[profile.currentLevel] ?? LEVEL_GRADIENTS[1]} bg-clip-text text-transparent`}>
                {profile.levelName}
              </h1>

              {/* XP bar */}
              {!profile.isMaxLevel && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-surface-500 mb-1">
                    <span>{profile.totalXp.toLocaleString()} XP</span>
                    <span>{profile.nextLevelXp.toLocaleString()} XP</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${LEVEL_GRADIENTS[profile.currentLevel] ?? LEVEL_GRADIENTS[1]} transition-all duration-1000 ease-out`}
                      style={{ width: `${Math.min(profile.progressPercent, 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {profile.isMaxLevel && (
                <p className="text-surface-400 text-xs mt-1">{profile.totalXp.toLocaleString()} XP total</p>
              )}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="glass rounded-xl p-3 text-center">
              <Zap className="h-4 w-4 text-accent-400 mx-auto mb-1" />
              <p className="text-white font-bold text-lg tabular-nums">{profile.totalXp.toLocaleString()}</p>
              <p className="text-surface-500 text-[10px] uppercase tracking-wider">Total XP</p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <Medal className="h-4 w-4 text-amber-400 mx-auto mb-1" />
              <p className="text-white font-bold text-lg tabular-nums">{earnedBadges.length}</p>
              <p className="text-surface-500 text-[10px] uppercase tracking-wider">Badges</p>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <Users className="h-4 w-4 text-brand-400 mx-auto mb-1" />
              <p className="text-white font-bold text-lg tabular-nums">{profile.rank ? `#${profile.rank}` : '—'}</p>
              <p className="text-surface-500 text-[10px] uppercase tracking-wider">Rank</p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Tab navigation ── */}
      <div className="px-5 mb-4">
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04]">
          {(['overview', 'badges', 'leaderboard'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-semibold tracking-wide capitalize transition-all duration-200 ${
                tab === t
                  ? 'bg-brand-500/20 text-brand-400 shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-5 pb-8 space-y-4">
        {tab === 'overview' && (
          <>
            {/* Level progression */}
            <section>
              <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand-400" />
                Level Progression
              </h2>
              <div className="space-y-2">
                {Object.entries(RIDER_LEVEL_NAMES || {}).map(([key, name]) => {
                  const lvl = Number(key);
                  const threshold = (RIDER_LEVEL_THRESHOLDS as Record<number, number>)[lvl] ?? 0;
                  const isCurrentLevel = lvl === profile.currentLevel;
                  const isUnlocked = lvl <= profile.currentLevel;

                  return (
                    <div
                      key={lvl}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                        isCurrentLevel
                          ? 'glass-elevated border border-brand-500/20'
                          : isUnlocked
                          ? 'glass'
                          : 'bg-white/[0.02]'
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${
                        isUnlocked ? '' : 'opacity-30 grayscale'
                      }`}>
                        {isUnlocked ? (
                          <span>{LEVEL_ICONS[lvl - 1]}</span>
                        ) : (
                          <Lock className="h-4 w-4 text-surface-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${isUnlocked ? 'text-white' : 'text-surface-600'}`}>
                            {name}
                          </span>
                          {isCurrentLevel && (
                            <span className="text-[10px] font-bold uppercase text-brand-400 bg-brand-400/10 px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] ${isUnlocked ? 'text-surface-400' : 'text-surface-600'}`}>
                          {threshold.toLocaleString()} XP required
                        </p>
                      </div>
                      {isUnlocked && (
                        <div className="text-accent-400">
                          <Shield className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Level perks */}
            <section>
              <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-400" />
                Level {profile.currentLevel} Perks
              </h2>
              <div className="glass rounded-2xl p-4 space-y-2.5">
                {(LEVEL_PERKS[profile.currentLevel] ?? []).map((perk, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-accent-500/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-3 w-3 text-accent-400" />
                    </div>
                    <p className="text-surface-300 text-sm">{perk}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Recent XP activity */}
            {profile.recentXpEvents.length > 0 && (
              <section>
                <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-accent-400" />
                  Recent XP
                </h2>
                <div className="glass rounded-2xl divide-y divide-white/[0.04] overflow-hidden">
                  {profile.recentXpEvents.slice(0, 8).map((evt) => {
                    const actionInfo = XP_ACTION_LABELS[evt.action] ?? { label: evt.action, icon: '✨' };
                    const date = new Date(evt.createdAt);
                    const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                    return (
                      <div key={evt.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-lg">{actionInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium">{actionInfo.label}</p>
                          <p className="text-surface-500 text-[11px]">{timeStr}</p>
                        </div>
                        <span className="text-accent-400 text-sm font-bold tabular-nums">+{evt.points}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {tab === 'badges' && (
          <>
            {Object.entries(badgesByCategory).map(([category, badges]) => {
              const catInfo = BADGE_CATEGORY_LABELS[category] ?? { label: category, Icon: Trophy };
              const CatIcon = catInfo.Icon;

              return (
                <section key={category}>
                  <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                    <CatIcon className="h-4 w-4 text-brand-400" />
                    {catInfo.label}
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {badges.map((badge) => {
                      const isEarned = !!badge.awardedAt;
                      return (
                        <div
                          key={badge.id ?? badge.slug}
                          className={`glass rounded-2xl p-3 text-center transition-all ${
                            isEarned ? '' : 'opacity-40 grayscale'
                          }`}
                        >
                          <div className="relative inline-flex mb-2">
                            {isEarned && (
                              <div className="absolute inset-0 bg-amber-400/10 rounded-full blur-lg scale-150" />
                            )}
                            <span className="relative text-3xl">{badge.icon}</span>
                          </div>
                          <p className="text-white text-[11px] font-semibold leading-tight">{badge.name}</p>
                          {isEarned && badge.xpReward > 0 && (
                            <p className="text-accent-400 text-[10px] font-medium mt-0.5">+{badge.xpReward} XP</p>
                          )}
                          {!isEarned && (
                            <div className="flex items-center justify-center mt-1">
                              <Lock className="h-3 w-3 text-surface-600" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {Object.keys(badgesByCategory).length === 0 && (
              <div className="glass rounded-2xl p-6 text-center">
                <Trophy className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                <p className="text-surface-400 text-sm">No badges available yet.</p>
                <p className="text-surface-500 text-xs mt-1">Complete deliveries to unlock badges!</p>
              </div>
            )}
          </>
        )}

        {tab === 'leaderboard' && (
          <>
            {leaderboard.length > 0 ? (
              <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                {leaderboard.map((entry, i) => {
                  const isTop3 = i < 3;
                  const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

                  return (
                    <div
                      key={entry.riderId}
                      className={`flex items-center gap-3 px-4 py-3 ${
                        entry.riderId === profile.riderId ? 'bg-brand-500/5' : ''
                      }`}
                    >
                      {/* Rank */}
                      <div className="w-8 text-center flex-shrink-0">
                        {medalEmoji ? (
                          <span className="text-lg">{medalEmoji}</span>
                        ) : (
                          <span className="text-surface-500 text-sm font-bold tabular-nums">#{entry.rank}</span>
                        )}
                      </div>

                      {/* Avatar/Level icon */}
                      <div className="h-9 w-9 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <span className="text-base">{LEVEL_ICONS[entry.currentLevel - 1] ?? '🏁'}</span>
                      </div>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${
                          entry.riderId === profile.riderId ? 'text-brand-400' : 'text-white'
                        }`}>
                          {entry.riderName}
                          {entry.riderId === profile.riderId && (
                            <span className="text-[10px] text-brand-400/60 ml-1">(You)</span>
                          )}
                        </p>
                        <p className="text-surface-500 text-[11px]">{entry.levelName}</p>
                      </div>

                      {/* XP */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-white text-sm font-bold tabular-nums">{entry.totalXp.toLocaleString()}</p>
                        <p className="text-surface-500 text-[10px]">XP</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass rounded-2xl p-6 text-center">
                <Users className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                <p className="text-surface-400 text-sm">Leaderboard is empty</p>
                <p className="text-surface-500 text-xs mt-1">Start earning XP to appear here!</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Badge celebration overlay */}
      {showBadgeCelebration && unseenBadges.length > 0 && (
        <BadgeCelebration
          badges={unseenBadges}
          onDismiss={handleBadgeCelebrationDismiss}
        />
      )}
    </div>
  );
}
