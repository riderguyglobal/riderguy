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
  Flame,
  Gift,
  Timer,
  CheckCircle2,
  Plus,
  ShoppingBag,
  Clock,
  Award,
} from 'lucide-react';
import { useGamification } from '@/hooks/use-gamification';
import type { LeaderboardCategory, LeaderboardTimeRange } from '@/hooks/use-gamification';
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
  challenge_complete: { label: 'Challenge Done',     icon: '🎯' },
};

const BADGE_CATEGORY_LABELS: Record<string, { label: string; Icon: typeof Trophy }> = {
  milestone:   { label: 'Milestones',   Icon: Target },
  achievement: { label: 'Achievements', Icon: Trophy },
  special:     { label: 'Special',      Icon: Crown },
};

const CHALLENGE_ACTION_LABELS: Record<string, string> = {
  delivery_complete: 'deliveries',
  on_time_delivery: 'on-time deliveries',
  five_star_rating: '5-star ratings',
  referral: 'referrals',
};

type MainTab = 'overview' | 'leaderboard' | 'challenges' | 'rewards';

export default function GamificationPage() {
  const {
    profile,
    leaderboard,
    unseenBadges,
    loading,
    error,
    streak,
    challenges,
    rewardItems,
    rewardBalance,
    redemptionHistory,
    bonusEvents,
    fetchLeaderboard,
    markBadgesSeen,
    fetchChallenges,
    joinChallenge,
    fetchRewardItems,
    fetchRewardBalance,
    fetchRedemptionHistory,
    redeemReward,
  } = useGamification();

  const [tab, setTab] = useState<MainTab>('overview');
  const [showBadgeCelebration, setShowBadgeCelebration] = useState(false);

  // Leaderboard state
  const [lbCategory, setLbCategory] = useState<LeaderboardCategory>('xp');
  const [lbTimeRange, setLbTimeRange] = useState<LeaderboardTimeRange>('alltime');

  // Rewards state
  const [rewardsTab, setRewardsTab] = useState<'browse' | 'history'>('browse');
  const [rewardCategory, setRewardCategory] = useState<string>('');
  const [redeeming, setRedeeming] = useState<string | null>(null);

  // Fetch data when tabs switch
  useEffect(() => {
    if (tab === 'leaderboard') fetchLeaderboard({ category: lbCategory, timeRange: lbTimeRange });
  }, [tab, lbCategory, lbTimeRange, fetchLeaderboard]);

  useEffect(() => {
    if (tab === 'challenges') fetchChallenges();
  }, [tab, fetchChallenges]);

  useEffect(() => {
    if (tab === 'rewards') {
      fetchRewardItems(rewardCategory || undefined);
      fetchRewardBalance();
      if (rewardsTab === 'history') fetchRedemptionHistory();
    }
  }, [tab, rewardsTab, rewardCategory, fetchRewardItems, fetchRewardBalance, fetchRedemptionHistory]);

  // Show unseen badges celebration
  useEffect(() => {
    if (unseenBadges.length > 0 && !showBadgeCelebration) {
      setShowBadgeCelebration(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unseenBadges.length]);

  const handleBadgeCelebrationDismiss = () => {
    setShowBadgeCelebration(false);
    const ids = unseenBadges.map(b => b.id);
    markBadgesSeen(ids);
  };

  const handleRedeem = async (itemId: string) => {
    setRedeeming(itemId);
    await redeemReward(itemId);
    setRedeeming(null);
    fetchRewardItems(rewardCategory || undefined);
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

  const badges = profile.badges ?? [];
  const recentXpEvents = profile.recentXpEvents ?? [];
  const earnedBadges = badges.filter(b => b.awardedAt);
  const badgesByCategory = badges.reduce<Record<string, typeof badges>>((acc, b) => {
    const cat = b.category || 'achievement';
    (acc[cat] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="min-h-[100dvh] bg-[#0a0e17]">
      {/* ── Header ── */}
      <header className="relative overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${LEVEL_GRADIENTS[profile.currentLevel] ?? LEVEL_GRADIENTS[1]} opacity-20`} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0e17]" />

        <div className="relative px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-surface-400 text-sm font-medium mb-6 btn-press"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>

          {/* Level display */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${LEVEL_GRADIENTS[profile.currentLevel] ?? LEVEL_GRADIENTS[1]} rounded-full blur-xl opacity-40 scale-125`} />
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
          <div className="grid grid-cols-4 gap-2.5 mt-5">
            <div className="glass rounded-xl p-2.5 text-center">
              <Zap className="h-3.5 w-3.5 text-accent-400 mx-auto mb-1" />
              <p className="text-white font-bold text-sm tabular-nums">{profile.totalXp.toLocaleString()}</p>
              <p className="text-surface-500 text-[9px] uppercase tracking-wider">XP</p>
            </div>
            <div className="glass rounded-xl p-2.5 text-center">
              <Medal className="h-3.5 w-3.5 text-amber-400 mx-auto mb-1" />
              <p className="text-white font-bold text-sm tabular-nums">{earnedBadges.length}</p>
              <p className="text-surface-500 text-[9px] uppercase tracking-wider">Badges</p>
            </div>
            <div className="glass rounded-xl p-2.5 text-center">
              <Flame className="h-3.5 w-3.5 text-orange-400 mx-auto mb-1" />
              <p className="text-white font-bold text-sm tabular-nums">{streak?.currentStreak ?? 0}</p>
              <p className="text-surface-500 text-[9px] uppercase tracking-wider">Streak</p>
            </div>
            <div className="glass rounded-xl p-2.5 text-center">
              <Gift className="h-3.5 w-3.5 text-pink-400 mx-auto mb-1" />
              <p className="text-white font-bold text-sm tabular-nums">{rewardBalance.toLocaleString()}</p>
              <p className="text-surface-500 text-[9px] uppercase tracking-wider">Points</p>
            </div>
          </div>

          {/* Active bonus XP banner */}
          {bonusEvents.length > 0 && (
            <div className="mt-4 glass-elevated rounded-xl p-3 border border-accent-500/20">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-accent-400 text-xs font-bold">{bonusEvents[0]?.title}</p>
                  <p className="text-surface-400 text-[10px]">{bonusEvents[0]?.multiplier}x XP — {bonusEvents[0]?.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Tab navigation ── */}
      <div className="px-5 mb-4">
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04]">
          {([
            { key: 'overview' as MainTab, label: 'Overview', icon: Star },
            { key: 'leaderboard' as MainTab, label: 'Ranks', icon: Trophy },
            { key: 'challenges' as MainTab, label: 'Challenges', icon: Target },
            { key: 'rewards' as MainTab, label: 'Rewards', icon: Gift },
          ]).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-semibold tracking-wide transition-all duration-200 flex flex-col items-center gap-1 ${
                  tab === t.key
                    ? 'bg-brand-500/20 text-brand-400 shadow-sm'
                    : 'text-surface-500 hover:text-surface-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-5 pb-8 space-y-4">

        {/* ════ OVERVIEW TAB ════ */}
        {tab === 'overview' && (
          <>
            {/* Streak banner */}
            {streak && (
              <section>
                <div className="glass-elevated rounded-2xl p-4 border border-orange-500/10">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="h-12 w-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <Flame className={`h-6 w-6 ${streak.currentStreak > 0 ? 'text-orange-400' : 'text-surface-600'}`} />
                      </div>
                      {streak.isActiveToday && (
                        <div className="absolute -top-1 -right-1 h-4 w-4 bg-accent-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-lg tabular-nums">{streak.currentStreak} Day{streak.currentStreak !== 1 ? 's' : ''}</p>
                      <p className="text-surface-400 text-xs">
                        {streak.isActiveToday ? 'Active today!' : 'Complete a delivery to continue'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-surface-500 text-[10px] uppercase tracking-wider">Best</p>
                      <p className="text-amber-400 font-bold tabular-nums">{streak.longestStreak}</p>
                    </div>
                  </div>
                  {/* Streak dots for last 7 days */}
                  <div className="flex gap-1.5 mt-3 justify-center">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const isActive = i < streak.currentStreak;
                      return (
                        <div
                          key={i}
                          className={`h-2 w-2 rounded-full ${isActive ? 'bg-orange-400' : 'bg-white/[0.06]'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

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
                        isCurrentLevel ? 'glass-elevated border border-brand-500/20'
                          : isUnlocked ? 'glass'
                          : 'bg-white/[0.02]'
                      }`}
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-lg ${isUnlocked ? '' : 'opacity-30 grayscale'}`}>
                        {isUnlocked ? <span>{LEVEL_ICONS[lvl - 1]}</span> : <Lock className="h-4 w-4 text-surface-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${isUnlocked ? 'text-white' : 'text-surface-600'}`}>{name}</span>
                          {isCurrentLevel && <span className="text-[10px] font-bold uppercase text-brand-400 bg-brand-400/10 px-2 py-0.5 rounded-full">Current</span>}
                        </div>
                        <p className={`text-[11px] ${isUnlocked ? 'text-surface-400' : 'text-surface-600'}`}>
                          {threshold.toLocaleString()} XP required
                        </p>
                      </div>
                      {isUnlocked && <Shield className="h-4 w-4 text-accent-400" />}
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

            {/* Badges */}
            {Object.keys(badgesByCategory).length > 0 && (
              <section>
                <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                  <Medal className="h-4 w-4 text-amber-400" />
                  Badges
                </h2>
                {Object.entries(badgesByCategory).map(([category, badges]) => (
                  <div key={category} className="mb-3">
                    <p className="text-surface-500 text-[10px] uppercase tracking-wider mb-2">{BADGE_CATEGORY_LABELS[category]?.label ?? category}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {badges.map((badge) => {
                        const isEarned = !!badge.awardedAt;
                        return (
                          <div key={badge.id ?? badge.slug} className={`glass rounded-xl p-2 text-center transition-all ${isEarned ? '' : 'opacity-30 grayscale'}`}>
                            <span className="text-2xl block mb-1">{badge.icon}</span>
                            <p className="text-white text-[9px] font-semibold leading-tight">{badge.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Recent XP */}
            {recentXpEvents.length > 0 && (
              <section>
                <h2 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-accent-400" />
                  Recent XP
                </h2>
                <div className="glass rounded-2xl divide-y divide-white/[0.04] overflow-hidden">
                  {recentXpEvents.slice(0, 8).map((evt) => {
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

        {/* ════ LEADERBOARD TAB ════ */}
        {tab === 'leaderboard' && (
          <>
            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
              {([
                { key: 'xp' as LeaderboardCategory, label: 'XP', icon: '⚡' },
                { key: 'deliveries' as LeaderboardCategory, label: 'Deliveries', icon: '📦' },
                { key: 'rating' as LeaderboardCategory, label: 'Rating', icon: '⭐' },
                { key: 'streak' as LeaderboardCategory, label: 'Streak', icon: '🔥' },
              ]).map((c) => (
                <button
                  key={c.key}
                  onClick={() => setLbCategory(c.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    lbCategory === c.key
                      ? 'bg-brand-500/20 text-brand-400'
                      : 'bg-white/[0.04] text-surface-500'
                  }`}
                >
                  <span>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>

            {/* Time range filter */}
            <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04]">
              {([
                { key: 'today' as LeaderboardTimeRange, label: 'Today' },
                { key: 'week' as LeaderboardTimeRange, label: 'Week' },
                { key: 'month' as LeaderboardTimeRange, label: 'Month' },
                { key: 'alltime' as LeaderboardTimeRange, label: 'All Time' },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setLbTimeRange(t.key)}
                  className={`flex-1 py-2 rounded-md text-[11px] font-semibold transition-all ${
                    lbTimeRange === t.key
                      ? 'bg-white/[0.08] text-white'
                      : 'text-surface-500'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Leaderboard list */}
            {leaderboard.length > 0 ? (
              <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
                {leaderboard.map((entry, i) => {
                  const medalEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                  return (
                    <div
                      key={entry.riderId}
                      className={`flex items-center gap-3 px-4 py-3 ${entry.isCurrentUser ? 'bg-brand-500/5' : ''}`}
                    >
                      <div className="w-8 text-center flex-shrink-0">
                        {medalEmoji ? (
                          <span className="text-lg">{medalEmoji}</span>
                        ) : (
                          <span className="text-surface-500 text-sm font-bold tabular-nums">#{entry.rank}</span>
                        )}
                      </div>
                      <div className="h-9 w-9 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <span className="text-base">{LEVEL_ICONS[entry.currentLevel - 1] ?? '🏁'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${entry.isCurrentUser ? 'text-brand-400' : 'text-white'}`}>
                          {entry.riderName}
                          {entry.isCurrentUser && <span className="text-[10px] text-brand-400/60 ml-1">(You)</span>}
                        </p>
                        <p className="text-surface-500 text-[11px]">{entry.levelName}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-white text-sm font-bold tabular-nums">{entry.totalXp.toLocaleString()}</p>
                        <p className="text-surface-500 text-[10px]">
                          {lbCategory === 'xp' ? 'XP' : lbCategory === 'deliveries' ? 'Deliveries' : lbCategory === 'rating' ? 'Rating' : 'Days'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="glass rounded-2xl p-6 text-center">
                <Users className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                <p className="text-surface-400 text-sm">No riders on the leaderboard yet</p>
                <p className="text-surface-500 text-xs mt-1">Start earning XP to appear here!</p>
              </div>
            )}
          </>
        )}

        {/* ════ CHALLENGES TAB ════ */}
        {tab === 'challenges' && (
          <>
            {challenges.length > 0 ? (
              <div className="space-y-3">
                {challenges.map((challenge) => (
                  <div key={challenge.id} className={`glass rounded-2xl p-4 transition-all ${challenge.isCompleted ? 'border border-accent-500/20' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="h-11 w-11 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">{challenge.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-white text-sm font-semibold">{challenge.title}</h3>
                          {challenge.isCompleted && (
                            <span className="text-[9px] font-bold uppercase text-accent-400 bg-accent-400/10 px-2 py-0.5 rounded-full">Done</span>
                          )}
                        </div>
                        <p className="text-surface-400 text-xs mt-0.5">{challenge.description}</p>

                        {/* Type & time remaining */}
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] font-medium text-surface-500 bg-white/[0.04] px-2 py-0.5 rounded capitalize">{challenge.type.toLowerCase()}</span>
                          <span className="text-[10px] text-surface-500 flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {challenge.timeRemaining}
                          </span>
                        </div>

                        {/* Progress */}
                        {challenge.isJoined && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[10px] text-surface-500 mb-1">
                              <span>{challenge.participation?.progress ?? 0} / {challenge.criteriaCount} {CHALLENGE_ACTION_LABELS[challenge.criteriaAction] ?? challenge.criteriaAction}</span>
                              <span>{challenge.progressPercent}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  challenge.isCompleted ? 'bg-accent-400' : 'bg-brand-400'
                                }`}
                                style={{ width: `${challenge.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Rewards */}
                        <div className="flex items-center gap-3 mt-2.5">
                          {challenge.xpReward > 0 && (
                            <span className="text-[10px] font-medium text-accent-400 flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              +{challenge.xpReward} XP
                            </span>
                          )}
                          {challenge.pointsReward > 0 && (
                            <span className="text-[10px] font-medium text-pink-400 flex items-center gap-1">
                              <Gift className="h-3 w-3" />
                              +{challenge.pointsReward} pts
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Join button */}
                      {!challenge.isJoined && (
                        <button
                          onClick={() => joinChallenge(challenge.id)}
                          className="bg-brand-500 text-white text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0 btn-press"
                        >
                          <Plus className="h-3.5 w-3.5 inline mr-1" />
                          Join
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass rounded-2xl p-6 text-center">
                <Target className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                <p className="text-surface-400 text-sm">No active challenges right now</p>
                <p className="text-surface-500 text-xs mt-1">Check back soon for new challenges!</p>
              </div>
            )}
          </>
        )}

        {/* ════ REWARDS TAB ════ */}
        {tab === 'rewards' && (
          <>
            {/* Points balance */}
            <div className="glass-elevated rounded-2xl p-4 border border-pink-500/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-surface-400 text-xs uppercase tracking-wider">Reward Points</p>
                  <p className="text-white text-2xl font-black tabular-nums mt-0.5">{rewardBalance.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-pink-500/10 flex items-center justify-center">
                  <Gift className="h-6 w-6 text-pink-400" />
                </div>
              </div>
            </div>

            {/* Browse / History sub-tabs */}
            <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04]">
              <button
                onClick={() => setRewardsTab('browse')}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  rewardsTab === 'browse' ? 'bg-white/[0.08] text-white' : 'text-surface-500'
                }`}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                Browse Store
              </button>
              <button
                onClick={() => setRewardsTab('history')}
                className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  rewardsTab === 'history' ? 'bg-white/[0.08] text-white' : 'text-surface-500'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                My Redemptions
              </button>
            </div>

            {rewardsTab === 'browse' && (
              <>
                {/* Category filter */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-5 px-5">
                  {[
                    { key: '', label: 'All' },
                    { key: 'merchandise', label: '🛍️ Merch' },
                    { key: 'voucher', label: '🎟️ Vouchers' },
                    { key: 'perk', label: '✨ Perks' },
                  ].map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setRewardCategory(c.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                        rewardCategory === c.key
                          ? 'bg-pink-500/20 text-pink-400'
                          : 'bg-white/[0.04] text-surface-500'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                {/* Items grid */}
                {rewardItems.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {rewardItems.map((item) => {
                      const canAfford = rewardBalance >= item.pointsCost;
                      const outOfStock = item.inventory === 0;
                      return (
                        <div key={item.id} className="glass rounded-2xl p-3 flex flex-col">
                          <div className="flex items-center gap-2 mb-2">
                            {item.isFeatured && (
                              <span className="text-[8px] font-bold uppercase text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">Featured</span>
                            )}
                          </div>
                          <div className="text-center mb-3">
                            <span className="text-4xl">{item.icon}</span>
                          </div>
                          <h3 className="text-white text-sm font-semibold text-center">{item.name}</h3>
                          <p className="text-surface-500 text-[10px] text-center mt-1 flex-1">{item.description}</p>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.04]">
                            <span className="text-pink-400 text-sm font-bold tabular-nums">{item.pointsCost.toLocaleString()} pts</span>
                            <button
                              onClick={() => handleRedeem(item.id)}
                              disabled={!canAfford || outOfStock || redeeming === item.id}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                                outOfStock
                                  ? 'bg-surface-700 text-surface-500 cursor-not-allowed'
                                  : canAfford
                                    ? 'bg-pink-500 text-white btn-press'
                                    : 'bg-white/[0.04] text-surface-500 cursor-not-allowed'
                              }`}
                            >
                              {redeeming === item.id ? '...' : outOfStock ? 'Out of Stock' : canAfford ? 'Redeem' : 'Need More'}
                            </button>
                          </div>
                          {item.inventory > 0 && item.inventory < 10 && (
                            <p className="text-amber-400/60 text-[9px] text-center mt-1">Only {item.inventory} left</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-6 text-center">
                    <ShoppingBag className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                    <p className="text-surface-400 text-sm">No rewards available yet</p>
                    <p className="text-surface-500 text-xs mt-1">Rewards will appear here soon!</p>
                  </div>
                )}
              </>
            )}

            {rewardsTab === 'history' && (
              <>
                {redemptionHistory.length > 0 ? (
                  <div className="glass rounded-2xl divide-y divide-white/[0.04] overflow-hidden">
                    {redemptionHistory.map((r) => {
                      const statusColors: Record<string, string> = {
                        PENDING: 'text-amber-400 bg-amber-400/10',
                        APPROVED: 'text-blue-400 bg-blue-400/10',
                        FULFILLED: 'text-accent-400 bg-accent-400/10',
                        REJECTED: 'text-danger-400 bg-danger-400/10',
                        CANCELLED: 'text-surface-500 bg-white/[0.04]',
                      };
                      return (
                        <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                          <span className="text-xl">{r.item?.icon ?? '🎁'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{r.item?.name ?? 'Reward'}</p>
                            <p className="text-surface-500 text-[11px]">{new Date(r.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColors[r.status] ?? ''}`}>
                              {r.status}
                            </span>
                            <p className="text-surface-500 text-[10px] mt-1">{r.pointsSpent} pts</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass rounded-2xl p-6 text-center">
                    <Award className="h-8 w-8 text-surface-500 mx-auto mb-3" />
                    <p className="text-surface-400 text-sm">No redemptions yet</p>
                    <p className="text-surface-500 text-xs mt-1">Redeem rewards from the store to see them here.</p>
                  </div>
                )}
              </>
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
