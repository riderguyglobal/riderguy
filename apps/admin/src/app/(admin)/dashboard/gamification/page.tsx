'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { getApiClient } from '@riderguy/auth';
import type { GamificationProfile } from '@riderguy/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Badge as UIBadge,
  Spinner,
} from '@riderguy/ui';

// ─── Types ──────────────────────────────────────────────────

interface BadgeItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  isActive: boolean;
  sortOrder: number;
  criteria: { action?: string; threshold?: number } | null;
  _count?: { riders: number };
}

interface ChallengeItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: string;
  status: string;
  criteriaAction: string;
  criteriaCount: number;
  xpReward: number;
  pointsReward: number;
  minLevel: number | null;
  maxLevel: number | null;
  startsAt: string;
  endsAt: string;
  _count?: { participants: number };
}

interface RewardStoreItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  pointsCost: number;
  inventory: number;
  isFeatured: boolean;
  isActive: boolean;
  _count?: { redemptions: number };
}

interface RedemptionItem {
  id: string;
  riderId: string;
  pointsSpent: number;
  status: string;
  notes: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  rider?: { user?: { firstName: string; lastName: string } };
  item?: { name: string; icon: string };
}

interface BonusXpEvent {
  id: string;
  title: string;
  description: string;
  multiplier: number;
  targetActions: string[];
  zoneId: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

// ─── Main Page ──────────────────────────────────────────────

type AdminTab = 'badges' | 'rider-lookup' | 'award-xp' | 'challenges' | 'rewards' | 'bonus-xp';

/** Admin campaign times are entered in Ghana time (UTC year-round). */
function ghanaDateTimeToIso(value: string, label: string): string {
  if (!value) throw new Error(`${label} is required`);
  const parsed = new Date(`${value}:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${label} is invalid`);
  return parsed.toISOString();
}

function validateCampaignWindow(startsAt: string, endsAt: string): void {
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    throw new Error('End time must be after the start time');
  }
}

export default function GamificationAdminPage() {
  const [tab, setTab] = useState<AdminTab>('badges');
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const mutationLocksRef = useRef(new Set<string>());
  const [pendingMutations, setPendingMutations] = useState<ReadonlySet<string>>(() => new Set());

  const beginMutation = useCallback((key: string) => {
    if (mutationLocksRef.current.has(key)) return false;
    const next = new Set(mutationLocksRef.current);
    next.add(key);
    mutationLocksRef.current = next;
    setPendingMutations(next);
    return true;
  }, []);

  const endMutation = useCallback((key: string) => {
    const next = new Set(mutationLocksRef.current);
    next.delete(key);
    mutationLocksRef.current = next;
    setPendingMutations(next);
  }, []);

  const isMutationPending = (key: string) => pendingMutations.has(key);

  // Challenge state
  const [challengesList, setChallengesList] = useState<ChallengeItem[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<ChallengeItem | null>(null);
  const [challengeForm, setChallengeForm] = useState({
    title: '',
    description: '',
    icon: '🎯',
    type: 'DAILY',
    criteriaAction: 'delivery_complete',
    criteriaCount: 5,
    xpReward: 100,
    pointsReward: 50,
    minLevel: '',
    maxLevel: '',
    startsAt: '',
    endsAt: '',
  });

  // Rewards state
  const [rewardsList, setRewardsList] = useState<RewardStoreItem[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardStoreItem | null>(null);
  const [rewardForm, setRewardForm] = useState({
    name: '',
    description: '',
    icon: '🎁',
    category: 'merchandise',
    pointsCost: 100,
    inventory: -1,
    isFeatured: false,
  });
  const [redemptionsList, setRedemptionsList] = useState<RedemptionItem[]>([]);
  const [rewardsSubTab, setRewardsSubTab] = useState<'items' | 'redemptions'>('items');
  const [rejectionTarget, setRejectionTarget] = useState<RedemptionItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionReasonError, setRejectionReasonError] = useState('');
  const rejectionDialogRef = useRef<HTMLDivElement>(null);
  const rejectionReasonRef = useRef<HTMLTextAreaElement>(null);

  // Bonus XP state
  const [bonusList, setBonusList] = useState<BonusXpEvent[]>([]);
  const [bonusLoading, setBonusLoading] = useState(false);
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [editingBonus, setEditingBonus] = useState<BonusXpEvent | null>(null);
  const [bonusForm, setBonusForm] = useState({
    title: '',
    description: '',
    multiplier: 2,
    targetActions: 'delivery_complete',
    startsAt: '',
    endsAt: '',
  });

  // Badge form
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [editingBadge, setEditingBadge] = useState<BadgeItem | null>(null);
  const [badgeForm, setBadgeForm] = useState({
    slug: '',
    name: '',
    description: '',
    icon: '🏆',
    category: 'achievement',
    xpReward: 0,
    sortOrder: 0,
    criteriaAction: '',
    criteriaThreshold: 0,
  });

  // Rider lookup
  const [riderId, setRiderId] = useState('');
  const [riderProfile, setRiderProfile] = useState<GamificationProfile | null>(null);
  const [riderLoading, setRiderLoading] = useState(false);

  // Award XP form
  const [awardRiderId, setAwardRiderId] = useState('');
  const [awardPoints, setAwardPoints] = useState(100);
  const [awardReason, setAwardReason] = useState('');

  // ── Fetch badges ──
  const fetchBadges = useCallback(async () => {
    try {
      setLoading(true);
      const api = getApiClient();
      const { data } = await api.get('/gamification/admin/badges');
      setBadges(data.data ?? []);
      setError('');
    } catch {
      setError('Failed to load badges');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  // ── Seed default badges ──
  const handleSeedBadges = async () => {
    const mutationKey = 'badges:seed';
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      await api.post('/gamification/admin/seed-badges');
      setSuccess('Default badges seeded successfully!');
      await fetchBadges();
    } catch {
      setError('Failed to seed badges');
    } finally {
      endMutation(mutationKey);
    }
  };

  // ── Create / Update badge ──
  const handleSaveBadge = async () => {
    const mutationKey = 'badges:save';
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      const payload: Record<string, unknown> = {
        slug: badgeForm.slug,
        name: badgeForm.name,
        description: badgeForm.description,
        icon: badgeForm.icon,
        category: badgeForm.category,
        xpReward: badgeForm.xpReward,
        sortOrder: badgeForm.sortOrder,
      };
      if (badgeForm.criteriaAction) {
        payload.criteria = {
          action: badgeForm.criteriaAction,
          threshold: badgeForm.criteriaThreshold,
        };
      } else if (editingBadge) {
        payload.criteria = null;
      }

      if (editingBadge) {
        await api.put(`/gamification/admin/badges/${editingBadge.id}`, payload);
        setSuccess('Badge updated!');
      } else {
        await api.post('/gamification/admin/badges', payload);
        setSuccess('Badge created!');
      }
      setShowBadgeForm(false);
      setEditingBadge(null);
      resetBadgeForm();
      await fetchBadges();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save badge');
    } finally {
      endMutation(mutationKey);
    }
  };

  // ── Delete badge ──
  const handleDeleteBadge = async (badgeId: string) => {
    const mutationKey = `badges:delete:${badgeId}`;
    if (mutationLocksRef.current.has(mutationKey)) return;
    if (!confirm('Delete this badge? This cannot be undone.')) return;
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      await api.delete(`/gamification/admin/badges/${badgeId}`);
      setSuccess('Badge deleted');
      await fetchBadges();
    } catch {
      setError('Failed to delete badge');
    } finally {
      endMutation(mutationKey);
    }
  };

  // ── Edit badge ──
  const handleEditBadge = (badge: BadgeItem) => {
    setEditingBadge(badge);
    setBadgeForm({
      slug: badge.slug,
      name: badge.name,
      description: badge.description,
      icon: badge.icon,
      category: badge.category,
      xpReward: badge.xpReward,
      sortOrder: badge.sortOrder,
      criteriaAction: badge.criteria?.action ?? '',
      criteriaThreshold: badge.criteria?.threshold ?? 0,
    });
    setShowBadgeForm(true);
  };

  const resetBadgeForm = () => {
    setBadgeForm({
      slug: '',
      name: '',
      description: '',
      icon: '🏆',
      category: 'achievement',
      xpReward: 0,
      sortOrder: 0,
      criteriaAction: '',
      criteriaThreshold: 0,
    });
  };

  // ── Rider lookup ──
  const handleLookupRider = async () => {
    if (!riderId.trim()) return;
    try {
      setRiderLoading(true);
      const api = getApiClient();
      const { data } = await api.get(`/gamification/admin/rider/${riderId.trim()}`);
      setRiderProfile(data.data);
      setError('');
    } catch {
      setError('Rider not found or failed to load');
      setRiderProfile(null);
    } finally {
      setRiderLoading(false);
    }
  };

  // ── Award XP ──
  const handleAwardXp = async () => {
    if (!awardRiderId.trim() || !awardReason.trim() || awardPoints < 1) return;
    const mutationKey = 'xp:award';
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      await api.post(`/gamification/admin/award-xp/${awardRiderId.trim()}`, {
        points: awardPoints,
        reason: awardReason,
      });
      setSuccess(`Awarded ${awardPoints} XP to rider ${awardRiderId.trim()}`);
      setAwardRiderId('');
      setAwardPoints(100);
      setAwardReason('');
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to award XP');
    } finally {
      endMutation(mutationKey);
    }
  };

  // Clear messages after 4s
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => {
        setSuccess('');
        setError('');
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  // ── Fetch challenges ──
  const fetchChallenges = useCallback(async () => {
    try {
      setChallengesLoading(true);
      const api = getApiClient();
      const { data } = await api.get('/gamification/admin/challenges');
      setChallengesList(data.data ?? []);
    } catch {
      setError('Failed to load challenges');
    } finally {
      setChallengesLoading(false);
    }
  }, []);

  // ── Save challenge ──
  const handleSaveChallenge = async () => {
    const mutationKey = 'challenges:save';
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      const startsAt = challengeForm.startsAt
        ? ghanaDateTimeToIso(challengeForm.startsAt, 'Start time')
        : new Date().toISOString();
      const endsAt = ghanaDateTimeToIso(challengeForm.endsAt, 'End time');
      validateCampaignWindow(startsAt, endsAt);
      const payload: Record<string, unknown> = {
        title: challengeForm.title,
        description: challengeForm.description,
        icon: challengeForm.icon,
        type: challengeForm.type,
        criteriaAction: challengeForm.criteriaAction,
        criteriaCount: challengeForm.criteriaCount,
        xpReward: challengeForm.xpReward,
        pointsReward: challengeForm.pointsReward,
        startsAt,
        endsAt,
      };
      if (challengeForm.minLevel) payload.minLevel = parseInt(challengeForm.minLevel);
      else if (editingChallenge) payload.minLevel = null;
      if (challengeForm.maxLevel) payload.maxLevel = parseInt(challengeForm.maxLevel);
      else if (editingChallenge) payload.maxLevel = null;

      if (editingChallenge) {
        await api.put(`/gamification/admin/challenges/${editingChallenge.id}`, payload);
        setSuccess('Challenge updated!');
      } else {
        await api.post('/gamification/admin/challenges', payload);
        setSuccess('Challenge created!');
      }
      setShowChallengeForm(false);
      setEditingChallenge(null);
      resetChallengeForm();
      await fetchChallenges();
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ??
          err?.response?.data?.message ??
          err?.message ??
          'Failed to save challenge',
      );
    } finally {
      endMutation(mutationKey);
    }
  };

  const handleEditChallenge = (c: ChallengeItem) => {
    setEditingChallenge(c);
    setChallengeForm({
      title: c.title,
      description: c.description,
      icon: c.icon,
      type: c.type,
      criteriaAction: c.criteriaAction,
      criteriaCount: c.criteriaCount,
      xpReward: c.xpReward,
      pointsReward: c.pointsReward,
      minLevel: c.minLevel?.toString() ?? '',
      maxLevel: c.maxLevel?.toString() ?? '',
      startsAt: c.startsAt?.slice(0, 16) ?? '',
      endsAt: c.endsAt?.slice(0, 16) ?? '',
    });
    setShowChallengeForm(true);
  };

  const handleDeleteChallenge = async (id: string) => {
    const mutationKey = `challenges:delete:${id}`;
    if (mutationLocksRef.current.has(mutationKey)) return;
    if (!confirm('Delete this challenge?')) return;
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      await api.delete(`/gamification/admin/challenges/${id}`);
      setSuccess('Challenge deleted');
      await fetchChallenges();
    } catch {
      setError('Failed to delete challenge');
    } finally {
      endMutation(mutationKey);
    }
  };

  const resetChallengeForm = () => {
    setChallengeForm({
      title: '',
      description: '',
      icon: '🎯',
      type: 'DAILY',
      criteriaAction: 'delivery_complete',
      criteriaCount: 5,
      xpReward: 100,
      pointsReward: 50,
      minLevel: '',
      maxLevel: '',
      startsAt: '',
      endsAt: '',
    });
  };

  // ── Fetch rewards ──
  const fetchRewards = useCallback(async () => {
    try {
      setRewardsLoading(true);
      const api = getApiClient();
      const { data } = await api.get('/gamification/admin/rewards');
      setRewardsList(data.data ?? []);
    } catch {
      setError('Failed to load rewards');
    } finally {
      setRewardsLoading(false);
    }
  }, []);

  const fetchRedemptions = useCallback(async () => {
    try {
      const api = getApiClient();
      const { data } = await api.get('/gamification/admin/redemptions');
      setRedemptionsList(data.data ?? []);
    } catch {
      setError('Failed to load redemptions');
    }
  }, []);

  // ── Save reward item ──
  const handleSaveReward = async () => {
    const mutationKey = 'rewards:save';
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      const payload = {
        name: rewardForm.name,
        description: rewardForm.description,
        icon: rewardForm.icon,
        category: rewardForm.category,
        pointsCost: rewardForm.pointsCost,
        inventory: rewardForm.inventory,
        isFeatured: rewardForm.isFeatured,
      };

      if (editingReward) {
        await api.put(`/gamification/admin/rewards/${editingReward.id}`, payload);
        setSuccess('Reward item updated!');
      } else {
        await api.post('/gamification/admin/rewards', payload);
        setSuccess('Reward item created!');
      }
      setShowRewardForm(false);
      setEditingReward(null);
      resetRewardForm();
      await fetchRewards();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save reward');
    } finally {
      endMutation(mutationKey);
    }
  };

  const handleEditReward = (r: RewardStoreItem) => {
    setEditingReward(r);
    setRewardForm({
      name: r.name,
      description: r.description,
      icon: r.icon,
      category: r.category,
      pointsCost: r.pointsCost,
      inventory: r.inventory,
      isFeatured: r.isFeatured,
    });
    setShowRewardForm(true);
  };

  const handleDeleteReward = async (id: string) => {
    const mutationKey = `rewards:delete:${id}`;
    if (mutationLocksRef.current.has(mutationKey)) return;
    if (!confirm('Delete this reward item?')) return;
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      await api.delete(`/gamification/admin/rewards/${id}`);
      setSuccess('Reward deleted');
      await fetchRewards();
    } catch {
      setError('Failed to delete reward');
    } finally {
      endMutation(mutationKey);
    }
  };

  const handleUpdateRedemption = async (
    redemptionId: string,
    status: string,
    reason?: string,
  ): Promise<boolean> => {
    const mutationKey = `redemptions:decision:${redemptionId}`;
    if (!beginMutation(mutationKey)) return false;
    try {
      const api = getApiClient();
      await api.put(`/gamification/admin/redemptions/${redemptionId}`, {
        status,
        ...(reason ? { reason: reason.trim() } : {}),
      });
      setSuccess(`Redemption ${status.toLowerCase()}`);
      await fetchRedemptions();
      return true;
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to update redemption');
      return false;
    } finally {
      endMutation(mutationKey);
    }
  };

  const openRejectionDialog = (redemption: RedemptionItem) => {
    setRejectionTarget(redemption);
    setRejectionReason('');
    setRejectionReasonError('');
  };

  const closeRejectionDialog = () => {
    if (
      rejectionTarget &&
      mutationLocksRef.current.has(`redemptions:decision:${rejectionTarget.id}`)
    ) {
      return;
    }
    setRejectionTarget(null);
    setRejectionReason('');
    setRejectionReasonError('');
  };

  const submitRedemptionRejection = async () => {
    if (!rejectionTarget) return;
    const normalizedReason = rejectionReason.trim();
    if (normalizedReason.length < 10) {
      setRejectionReasonError('Explain the decision in at least 10 characters.');
      rejectionReasonRef.current?.focus();
      return;
    }

    setRejectionReasonError('');
    const updated = await handleUpdateRedemption(rejectionTarget.id, 'REJECTED', normalizedReason);
    if (updated) closeRejectionDialog();
  };

  useEffect(() => {
    if (!rejectionTarget) return;
    const returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    rejectionReasonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        !mutationLocksRef.current.has(`redemptions:decision:${rejectionTarget.id}`)
      ) {
        setRejectionTarget(null);
        setRejectionReason('');
        setRejectionReasonError('');
      }

      if (event.key === 'Tab') {
        const focusable = Array.from(
          rejectionDialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      returnFocus?.focus();
    };
  }, [rejectionTarget]);

  const resetRewardForm = () => {
    setRewardForm({
      name: '',
      description: '',
      icon: '🎁',
      category: 'merchandise',
      pointsCost: 100,
      inventory: -1,
      isFeatured: false,
    });
  };

  // ── Fetch bonus XP ──
  const fetchBonusEvents = useCallback(async () => {
    try {
      setBonusLoading(true);
      const api = getApiClient();
      const { data } = await api.get('/gamification/admin/bonus-events');
      setBonusList(data.data ?? []);
    } catch {
      setError('Failed to load bonus XP events');
    } finally {
      setBonusLoading(false);
    }
  }, []);

  const handleSaveBonus = async () => {
    const mutationKey = 'bonus-events:save';
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      const startsAt = bonusForm.startsAt
        ? ghanaDateTimeToIso(bonusForm.startsAt, 'Start time')
        : new Date().toISOString();
      const endsAt = ghanaDateTimeToIso(bonusForm.endsAt, 'End time');
      validateCampaignWindow(startsAt, endsAt);
      const payload = {
        title: bonusForm.title,
        description: bonusForm.description,
        multiplier: bonusForm.multiplier,
        targetActions: bonusForm.targetActions
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        startsAt,
        endsAt,
      };

      if (editingBonus) {
        await api.put(`/gamification/admin/bonus-events/${editingBonus.id}`, payload);
        setSuccess('Bonus XP event updated!');
      } else {
        await api.post('/gamification/admin/bonus-events', payload);
        setSuccess('Bonus XP event created!');
      }
      setShowBonusForm(false);
      setEditingBonus(null);
      resetBonusForm();
      await fetchBonusEvents();
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ??
          err?.response?.data?.message ??
          err?.message ??
          'Failed to save bonus event',
      );
    } finally {
      endMutation(mutationKey);
    }
  };

  const handleEditBonus = (b: BonusXpEvent) => {
    setEditingBonus(b);
    setBonusForm({
      title: b.title,
      description: b.description,
      multiplier: b.multiplier,
      targetActions: b.targetActions.join(', '),
      startsAt: b.startsAt?.slice(0, 16) ?? '',
      endsAt: b.endsAt?.slice(0, 16) ?? '',
    });
    setShowBonusForm(true);
  };

  const handleDeleteBonus = async (id: string) => {
    const mutationKey = `bonus-events:delete:${id}`;
    if (mutationLocksRef.current.has(mutationKey)) return;
    if (!confirm('Delete this bonus XP event?')) return;
    if (!beginMutation(mutationKey)) return;
    try {
      const api = getApiClient();
      await api.delete(`/gamification/admin/bonus-events/${id}`);
      setSuccess('Bonus event deleted');
      await fetchBonusEvents();
    } catch {
      setError('Failed to delete bonus event');
    } finally {
      endMutation(mutationKey);
    }
  };

  const resetBonusForm = () => {
    setBonusForm({
      title: '',
      description: '',
      multiplier: 2,
      targetActions: 'delivery_complete',
      startsAt: '',
      endsAt: '',
    });
  };

  // Fetch data when tabs switch
  useEffect(() => {
    if (tab === 'challenges') fetchChallenges();
    if (tab === 'rewards') {
      fetchRewards();
      fetchRedemptions();
    }
    if (tab === 'bonus-xp') fetchBonusEvents();
  }, [tab, fetchChallenges, fetchRewards, fetchRedemptions, fetchBonusEvents]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="admin-kicker">Rider engagement</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-[#07110D]">
            Growth &amp; rewards
          </h1>
          <p className="mt-2 text-sm text-[#6E7A73]">
            Manage badges, challenges, rewards, XP events, and rider levels.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedBadges}
            disabled={isMutationPending('badges:seed')}
          >
            {isMutationPending('badges:seed') ? 'Seeding…' : 'Seed Default Badges'}
          </Button>
        </div>
      </div>
      {/* Status messages */}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {[
          { key: 'badges' as AdminTab, label: 'Badges' },
          { key: 'challenges' as AdminTab, label: 'Challenges' },
          { key: 'rewards' as AdminTab, label: 'Rewards Store' },
          { key: 'bonus-xp' as AdminTab, label: 'Bonus XP' },
          { key: 'rider-lookup' as AdminTab, label: 'Rider Lookup' },
          { key: 'award-xp' as AdminTab, label: 'Award XP' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* ── Badges Tab ── */}
      {tab === 'badges' && (
        <div className="space-y-4">
          {/* Create button */}
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditingBadge(null);
                resetBadgeForm();
                setShowBadgeForm(true);
              }}
            >
              + Create Badge
            </Button>
          </div>

          {/* Badge form */}
          {showBadgeForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingBadge ? 'Edit Badge' : 'Create Badge'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Slug</label>
                    <Input
                      value={badgeForm.slug}
                      onChange={(e) => setBadgeForm((p) => ({ ...p, slug: e.target.value }))}
                      placeholder="first_delivery"
                      disabled={!!editingBadge}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                    <Input
                      value={badgeForm.name}
                      onChange={(e) => setBadgeForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="First Delivery"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <Input
                    value={badgeForm.description}
                    onChange={(e) => setBadgeForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Complete your first delivery"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Icon</label>
                    <Input
                      value={badgeForm.icon}
                      onChange={(e) => setBadgeForm((p) => ({ ...p, icon: e.target.value }))}
                      placeholder="🏆"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
                    <select
                      value={badgeForm.category}
                      onChange={(e) => setBadgeForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="milestone">Milestone</option>
                      <option value="achievement">Achievement</option>
                      <option value="special">Special</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      XP Reward
                    </label>
                    <Input
                      type="number"
                      value={badgeForm.xpReward}
                      onChange={(e) =>
                        setBadgeForm((p) => ({ ...p, xpReward: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Sort Order
                    </label>
                    <Input
                      type="number"
                      value={badgeForm.sortOrder}
                      onChange={(e) =>
                        setBadgeForm((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Criteria Action (optional)
                    </label>
                    <select
                      value={badgeForm.criteriaAction}
                      onChange={(e) =>
                        setBadgeForm((p) => ({ ...p, criteriaAction: e.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">None</option>
                      <option value="delivery_complete">Delivery Complete</option>
                      <option value="five_star_rating">5-Star Rating</option>
                      <option value="streak_7">7-Day Streak</option>
                      <option value="streak_30">30-Day Streak</option>
                      <option value="on_time_delivery">On-Time Delivery</option>
                      <option value="referral">Referral</option>
                      <option value="perfect_week">Perfect Week</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Criteria Threshold
                    </label>
                    <Input
                      type="number"
                      value={badgeForm.criteriaThreshold}
                      onChange={(e) =>
                        setBadgeForm((p) => ({
                          ...p,
                          criteriaThreshold: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveBadge} disabled={isMutationPending('badges:save')}>
                    {isMutationPending('badges:save')
                      ? 'Saving…'
                      : editingBadge
                        ? 'Update'
                        : 'Create'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isMutationPending('badges:save')}
                    onClick={() => {
                      setShowBadgeForm(false);
                      setEditingBadge(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Badges table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="text-brand-500 h-6 w-6" />
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px]">
                    <thead>
                      <tr className="border-b bg-gray-50/50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Badge
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          XP
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Criteria
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Earned By
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {badges.map((badge) => (
                        <tr key={badge.id} className="transition-colors hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{badge.icon}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{badge.name}</p>
                                <p className="text-xs text-gray-500">{badge.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <UIBadge
                              className={
                                badge.category === 'milestone'
                                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                                  : badge.category === 'special'
                                    ? 'bg-purple-100 text-purple-800 hover:bg-purple-100'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                              }
                            >
                              {badge.category}
                            </UIBadge>
                          </td>
                          <td className="px-4 py-3 text-sm font-medium tabular-nums text-gray-600">
                            +{badge.xpReward}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {badge.criteria?.action ? (
                              `${badge.criteria.action} × ${badge.criteria.threshold}`
                            ) : (
                              <span className="text-gray-400">Manual</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                            {badge._count?.riders ?? 0}
                          </td>
                          <td className="px-4 py-3">
                            <UIBadge
                              className={
                                badge.isActive
                                  ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-100'
                              }
                            >
                              {badge.isActive ? 'Active' : 'Inactive'}
                            </UIBadge>
                          </td>
                          <td className="space-x-2 px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isMutationPending(`badges:delete:${badge.id}`)}
                              onClick={() => handleEditBadge(badge)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              disabled={isMutationPending(`badges:delete:${badge.id}`)}
                              onClick={() => handleDeleteBadge(badge.id)}
                            >
                              {isMutationPending(`badges:delete:${badge.id}`)
                                ? 'Deleting…'
                                : 'Delete'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {badges.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                            No badges yet. Click &quot;Seed Default Badges&quot; to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {/* ── Rider Lookup Tab ── */}
      {tab === 'rider-lookup' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Look Up Rider Gamification Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={riderId}
                  onChange={(e) => setRiderId(e.target.value)}
                  placeholder="Enter Rider Profile ID"
                  className="max-w-sm"
                />
                <Button onClick={handleLookupRider} disabled={riderLoading}>
                  {riderLoading ? <Spinner className="h-4 w-4" /> : 'Lookup'}
                </Button>
              </div>

              {riderProfile && (
                <div className="grid grid-cols-3 gap-4 border-t pt-4">
                  <div className="rounded-lg bg-blue-50 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">
                      {riderProfile.totalXp.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-blue-600">Total XP</p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-4 text-center">
                    <p className="text-2xl font-bold text-purple-700">
                      Level {riderProfile.currentLevel}
                    </p>
                    <p className="mt-1 text-xs text-purple-600">{riderProfile.levelName}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">
                      {riderProfile.badges.length}
                    </p>
                    <p className="mt-1 text-xs text-amber-600">Badges Earned</p>
                  </div>

                  {/* Progress bar */}
                  <div className="col-span-3">
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                      <span>Level Progress</span>
                      <span>{Math.round(riderProfile.progressPercent)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                        style={{ width: `${riderProfile.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Badges */}
                  {riderProfile.badges.length > 0 && (
                    <div className="col-span-3">
                      <p className="mb-2 text-sm font-medium text-gray-700">Earned Badges</p>
                      <div className="flex flex-wrap gap-2">
                        {riderProfile.badges.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center gap-1.5 rounded-full border bg-gray-50 px-3 py-1.5"
                          >
                            <span>{b.badge.icon}</span>
                            <span className="text-xs font-medium text-gray-700">
                              {b.badge.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent XP events */}
                  {riderProfile.recentXp.length > 0 && (
                    <div className="col-span-3">
                      <p className="mb-2 text-sm font-medium text-gray-700">Recent XP Events</p>
                      <div className="divide-y overflow-hidden rounded-lg border">
                        {riderProfile.recentXp.slice(0, 10).map((evt) => (
                          <div
                            key={evt.id}
                            className="flex items-center justify-between px-3 py-2 text-sm"
                          >
                            <span className="text-gray-700">{evt.action.replace(/_/g, ' ')}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-medium text-green-600">+{evt.points}</span>
                              <span className="text-xs text-gray-400">
                                {new Date(evt.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {/* ── Award XP Tab ── */}
      {tab === 'award-xp' && (
        <Card>
          <CardHeader>
            <CardTitle>Award XP to Rider</CardTitle>
          </CardHeader>
          <CardContent className="max-w-md space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Rider Profile ID
              </label>
              <Input
                value={awardRiderId}
                onChange={(e) => setAwardRiderId(e.target.value)}
                placeholder="Enter rider profile ID"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Points</label>
              <Input
                type="number"
                min={1}
                max={10000}
                value={awardPoints}
                onChange={(e) => setAwardPoints(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
              <Input
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                placeholder="e.g., Bonus for excellent service"
              />
            </div>
            <Button
              onClick={handleAwardXp}
              disabled={
                !awardRiderId || !awardReason || awardPoints < 1 || isMutationPending('xp:award')
              }
            >
              {isMutationPending('xp:award') ? 'Awarding XP…' : `Award ${awardPoints} XP`}
            </Button>
          </CardContent>
        </Card>
      )}
      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── Challenges Tab (Sprint 10) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === 'challenges' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditingChallenge(null);
                resetChallengeForm();
                setShowChallengeForm(true);
              }}
            >
              + Create Challenge
            </Button>
          </div>

          {/* Challenge form */}
          {showChallengeForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingChallenge ? 'Edit Challenge' : 'Create Challenge'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                    <Input
                      value={challengeForm.title}
                      onChange={(e) => setChallengeForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Complete 10 Deliveries"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Icon</label>
                    <Input
                      value={challengeForm.icon}
                      onChange={(e) => setChallengeForm((p) => ({ ...p, icon: e.target.value }))}
                      placeholder="🎯"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <Input
                    value={challengeForm.description}
                    onChange={(e) =>
                      setChallengeForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Complete 10 deliveries today to earn bonus XP"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                    <select
                      value={challengeForm.type}
                      onChange={(e) => setChallengeForm((p) => ({ ...p, type: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Criteria Action
                    </label>
                    <select
                      value={challengeForm.criteriaAction}
                      onChange={(e) =>
                        setChallengeForm((p) => ({ ...p, criteriaAction: e.target.value }))
                      }
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="delivery_complete">Delivery Complete</option>
                      <option value="on_time_delivery">On-Time Delivery</option>
                      <option value="five_star_rating">5-Star Rating</option>
                      <option value="referral">Referral</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Criteria Count
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={challengeForm.criteriaCount}
                      onChange={(e) =>
                        setChallengeForm((p) => ({
                          ...p,
                          criteriaCount: parseInt(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      XP Reward
                    </label>
                    <Input
                      type="number"
                      value={challengeForm.xpReward}
                      onChange={(e) =>
                        setChallengeForm((p) => ({ ...p, xpReward: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Points Reward
                    </label>
                    <Input
                      type="number"
                      value={challengeForm.pointsReward}
                      onChange={(e) =>
                        setChallengeForm((p) => ({
                          ...p,
                          pointsReward: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Min Level
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={challengeForm.minLevel}
                      onChange={(e) =>
                        setChallengeForm((p) => ({ ...p, minLevel: e.target.value }))
                      }
                      placeholder="Any"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Max Level
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={challengeForm.maxLevel}
                      onChange={(e) =>
                        setChallengeForm((p) => ({ ...p, maxLevel: e.target.value }))
                      }
                      placeholder="Any"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Starts At
                    </label>
                    <Input
                      type="datetime-local"
                      value={challengeForm.startsAt}
                      onChange={(e) =>
                        setChallengeForm((p) => ({ ...p, startsAt: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Ends At</label>
                    <Input
                      type="datetime-local"
                      value={challengeForm.endsAt}
                      onChange={(e) => setChallengeForm((p) => ({ ...p, endsAt: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSaveChallenge}
                    disabled={isMutationPending('challenges:save')}
                  >
                    {isMutationPending('challenges:save')
                      ? 'Saving…'
                      : editingChallenge
                        ? 'Update'
                        : 'Create'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isMutationPending('challenges:save')}
                    onClick={() => {
                      setShowChallengeForm(false);
                      setEditingChallenge(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Challenges table */}
          {challengesLoading ? (
            <div className="flex justify-center py-12">
              <Spinner className="text-brand-500 h-6 w-6" />
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px]">
                    <thead>
                      <tr className="border-b bg-gray-50/50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Challenge
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Goal
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Rewards
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Participants
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Ends
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {challengesList.map((c) => (
                        <tr key={c.id} className="transition-colors hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{c.icon}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{c.title}</p>
                                <p className="max-w-xs truncate text-xs text-gray-500">
                                  {c.description}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <UIBadge
                              className={
                                c.type === 'DAILY'
                                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                                  : c.type === 'WEEKLY'
                                    ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100'
                                    : c.type === 'MONTHLY'
                                      ? 'bg-purple-100 text-purple-800 hover:bg-purple-100'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                              }
                            >
                              {c.type}
                            </UIBadge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {c.criteriaCount}× {c.criteriaAction.replace(/_/g, ' ')}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <div>+{c.xpReward} XP</div>
                            {c.pointsReward > 0 && <div>+{c.pointsReward} pts</div>}
                          </td>
                          <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                            {c._count?.participants ?? 0}
                          </td>
                          <td className="px-4 py-3">
                            <UIBadge
                              className={
                                c.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                  : c.status === 'COMPLETED'
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                    : c.status === 'EXPIRED'
                                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                      : c.status === 'DRAFT'
                                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                                        : 'bg-red-100 text-red-700 hover:bg-red-100'
                              }
                            >
                              {c.status}
                            </UIBadge>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {new Date(c.endsAt).toLocaleDateString()}
                          </td>
                          <td className="space-x-2 px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isMutationPending(`challenges:delete:${c.id}`)}
                              onClick={() => handleEditChallenge(c)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              disabled={isMutationPending(`challenges:delete:${c.id}`)}
                              onClick={() => handleDeleteChallenge(c.id)}
                            >
                              {isMutationPending(`challenges:delete:${c.id}`)
                                ? 'Deleting…'
                                : 'Delete'}
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {challengesList.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-sm text-gray-400">
                            No challenges yet. Create one to get started.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── Rewards Store Tab (Sprint 10) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === 'rewards' && (
        <div className="space-y-4">
          {/* Sub-tabs: items vs redemptions */}
          <div className="flex gap-1 border-b border-gray-200">
            <button
              onClick={() => setRewardsSubTab('items')}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                rewardsSubTab === 'items'
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Store Items
            </button>
            <button
              onClick={() => setRewardsSubTab('redemptions')}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                rewardsSubTab === 'redemptions'
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Redemptions
            </button>
          </div>

          {rewardsSubTab === 'items' && (
            <>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingReward(null);
                    resetRewardForm();
                    setShowRewardForm(true);
                  }}
                >
                  + Add Reward Item
                </Button>
              </div>

              {/* Reward form */}
              {showRewardForm && (
                <Card>
                  <CardHeader>
                    <CardTitle>{editingReward ? 'Edit Reward Item' : 'Add Reward Item'}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                        <Input
                          value={rewardForm.name}
                          onChange={(e) => setRewardForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Riderguy T-Shirt"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Icon</label>
                        <Input
                          value={rewardForm.icon}
                          onChange={(e) => setRewardForm((p) => ({ ...p, icon: e.target.value }))}
                          placeholder="👕"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <Input
                        value={rewardForm.description}
                        onChange={(e) =>
                          setRewardForm((p) => ({ ...p, description: e.target.value }))
                        }
                        placeholder="Official Riderguy branded t-shirt"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Category
                        </label>
                        <select
                          value={rewardForm.category}
                          onChange={(e) =>
                            setRewardForm((p) => ({ ...p, category: e.target.value }))
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="merchandise">Merchandise</option>
                          <option value="voucher">Voucher</option>
                          <option value="perk">Perk</option>
                          <option value="digital">Digital</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Points Cost
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={rewardForm.pointsCost}
                          onChange={(e) =>
                            setRewardForm((p) => ({
                              ...p,
                              pointsCost: parseInt(e.target.value) || 1,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Inventory
                        </label>
                        <Input
                          type="number"
                          min={-1}
                          value={rewardForm.inventory}
                          onChange={(e) =>
                            setRewardForm((p) => ({
                              ...p,
                              inventory: parseInt(e.target.value) ?? -1,
                            }))
                          }
                        />
                        <p className="mt-1 text-[10px] text-gray-400">-1 = unlimited</p>
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={rewardForm.isFeatured}
                            onChange={(e) =>
                              setRewardForm((p) => ({ ...p, isFeatured: e.target.checked }))
                            }
                            className="rounded border-gray-300"
                          />
                          Featured
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleSaveReward}
                        disabled={isMutationPending('rewards:save')}
                      >
                        {isMutationPending('rewards:save')
                          ? 'Saving…'
                          : editingReward
                            ? 'Update'
                            : 'Create'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={isMutationPending('rewards:save')}
                        onClick={() => {
                          setShowRewardForm(false);
                          setEditingReward(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rewards table */}
              {rewardsLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner className="text-brand-500 h-6 w-6" />
                </div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[920px]">
                        <thead>
                          <tr className="border-b bg-gray-50/50">
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                              Item
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                              Category
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                              Cost
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                              Inventory
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                              Redeemed
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                              Status
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {rewardsList.map((r) => (
                            <tr key={r.id} className="transition-colors hover:bg-gray-50/50">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{r.icon}</span>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{r.name}</p>
                                    <p className="max-w-xs truncate text-xs text-gray-500">
                                      {r.description}
                                    </p>
                                  </div>
                                  {r.isFeatured && (
                                    <UIBadge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                      ⭐ Featured
                                    </UIBadge>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <UIBadge className="bg-gray-100 capitalize text-gray-700 hover:bg-gray-100">
                                  {r.category}
                                </UIBadge>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium tabular-nums text-gray-600">
                                {r.pointsCost.toLocaleString()} pts
                              </td>
                              <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                                {r.inventory === -1 ? '∞' : r.inventory}
                              </td>
                              <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                                {r._count?.redemptions ?? 0}
                              </td>
                              <td className="px-4 py-3">
                                <UIBadge
                                  className={
                                    r.isActive
                                      ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-100'
                                  }
                                >
                                  {r.isActive ? 'Active' : 'Inactive'}
                                </UIBadge>
                              </td>
                              <td className="space-x-2 px-4 py-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isMutationPending(`rewards:delete:${r.id}`)}
                                  onClick={() => handleEditReward(r)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  disabled={isMutationPending(`rewards:delete:${r.id}`)}
                                  onClick={() => handleDeleteReward(r.id)}
                                >
                                  {isMutationPending(`rewards:delete:${r.id}`)
                                    ? 'Deleting…'
                                    : 'Delete'}
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {rewardsList.length === 0 && (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-4 py-12 text-center text-sm text-gray-400"
                              >
                                No reward items yet. Add one to get started.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {rewardsSubTab === 'redemptions' && (
            <Card>
              <CardHeader>
                <CardTitle>Reward Redemptions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px]">
                    <thead>
                      <tr className="border-b bg-gray-50/50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Rider
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Item
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Points
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {redemptionsList.map((r) => {
                        const riderName = r.rider?.user
                          ? `${r.rider.user.firstName} ${r.rider.user.lastName}`
                          : r.riderId.slice(0, 8);
                        return (
                          <tr key={r.id} className="transition-colors hover:bg-gray-50/50">
                            <td className="px-4 py-3 text-sm text-gray-700">{riderName}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                <span>{r.item?.icon ?? '🎁'}</span>
                                <span className="text-sm text-gray-700">
                                  {r.item?.name ?? 'Unknown'}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm tabular-nums text-gray-600">
                              {r.pointsSpent}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(r.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <UIBadge
                                className={
                                  r.status === 'PENDING'
                                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                    : r.status === 'APPROVED'
                                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                      : r.status === 'FULFILLED'
                                        ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                        : r.status === 'REJECTED'
                                          ? 'bg-red-100 text-red-700 hover:bg-red-100'
                                          : 'bg-gray-100 text-gray-500 hover:bg-gray-100'
                                }
                              >
                                {r.status}
                              </UIBadge>
                            </td>
                            <td className="space-x-1 px-4 py-3 text-right">
                              {r.status === 'PENDING' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600"
                                    disabled={isMutationPending(`redemptions:decision:${r.id}`)}
                                    onClick={() => handleUpdateRedemption(r.id, 'APPROVED')}
                                  >
                                    {isMutationPending(`redemptions:decision:${r.id}`)
                                      ? 'Approving…'
                                      : 'Approve'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600"
                                    disabled={isMutationPending(`redemptions:decision:${r.id}`)}
                                    onClick={() => openRejectionDialog(r)}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              {r.status === 'APPROVED' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600"
                                  disabled={isMutationPending(`redemptions:decision:${r.id}`)}
                                  onClick={() => handleUpdateRedemption(r.id, 'FULFILLED')}
                                >
                                  {isMutationPending(`redemptions:decision:${r.id}`)
                                    ? 'Updating…'
                                    : 'Mark Fulfilled'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {redemptionsList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                            No redemptions yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── Bonus XP Events Tab (Sprint 10) ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === 'bonus-xp' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditingBonus(null);
                resetBonusForm();
                setShowBonusForm(true);
              }}
            >
              + Create Bonus XP Event
            </Button>
          </div>

          {/* Bonus form */}
          {showBonusForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingBonus ? 'Edit Bonus XP Event' : 'Create Bonus XP Event'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                    <Input
                      value={bonusForm.title}
                      onChange={(e) => setBonusForm((p) => ({ ...p, title: e.target.value }))}
                      placeholder="Double XP Weekend"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Multiplier
                    </label>
                    <Input
                      type="number"
                      min={1.1}
                      step={0.1}
                      max={10}
                      value={bonusForm.multiplier}
                      onChange={(e) =>
                        setBonusForm((p) => ({ ...p, multiplier: parseFloat(e.target.value) || 2 }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <Input
                    value={bonusForm.description}
                    onChange={(e) => setBonusForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Earn double XP on all deliveries this weekend!"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Target Actions (comma-separated)
                  </label>
                  <Input
                    value={bonusForm.targetActions}
                    onChange={(e) => setBonusForm((p) => ({ ...p, targetActions: e.target.value }))}
                    placeholder="delivery_complete, on_time_delivery"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Leave empty for all actions</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Starts At
                    </label>
                    <Input
                      type="datetime-local"
                      value={bonusForm.startsAt}
                      onChange={(e) => setBonusForm((p) => ({ ...p, startsAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Ends At</label>
                    <Input
                      type="datetime-local"
                      value={bonusForm.endsAt}
                      onChange={(e) => setBonusForm((p) => ({ ...p, endsAt: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSaveBonus}
                    disabled={isMutationPending('bonus-events:save')}
                  >
                    {isMutationPending('bonus-events:save')
                      ? 'Saving…'
                      : editingBonus
                        ? 'Update'
                        : 'Create'}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={isMutationPending('bonus-events:save')}
                    onClick={() => {
                      setShowBonusForm(false);
                      setEditingBonus(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bonus events table */}
          {bonusLoading ? (
            <div className="flex justify-center py-12">
              <Spinner className="text-brand-500 h-6 w-6" />
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px]">
                    <thead>
                      <tr className="border-b bg-gray-50/50">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Event
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Multiplier
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Actions
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Schedule
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          Status
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bonusList.map((b) => {
                        const now = new Date();
                        const starts = new Date(b.startsAt);
                        const ends = new Date(b.endsAt);
                        const isLive = b.isActive && starts <= now && ends >= now;
                        const isUpcoming = b.isActive && starts > now;

                        return (
                          <tr key={b.id} className="transition-colors hover:bg-gray-50/50">
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900">{b.title}</p>
                              <p className="max-w-xs truncate text-xs text-gray-500">
                                {b.description}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-bold text-purple-600">
                                {b.multiplier}×
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {b.targetActions.length > 0 ? (
                                b.targetActions.map((a) => a.replace(/_/g, ' ')).join(', ')
                              ) : (
                                <span className="text-gray-400">All actions</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              <div>
                                {new Date(b.startsAt).toLocaleDateString()} –{' '}
                                {new Date(b.endsAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <UIBadge
                                className={
                                  isLive
                                    ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                    : isUpcoming
                                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                      : !b.isActive
                                        ? 'bg-gray-100 text-gray-500 hover:bg-gray-100'
                                        : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                }
                              >
                                {isLive
                                  ? '🔴 LIVE'
                                  : isUpcoming
                                    ? 'Upcoming'
                                    : !b.isActive
                                      ? 'Disabled'
                                      : 'Expired'}
                              </UIBadge>
                            </td>
                            <td className="space-x-2 px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isMutationPending(`bonus-events:delete:${b.id}`)}
                                onClick={() => handleEditBonus(b)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                disabled={isMutationPending(`bonus-events:delete:${b.id}`)}
                                onClick={() => handleDeleteBonus(b.id)}
                              >
                                {isMutationPending(`bonus-events:delete:${b.id}`)
                                  ? 'Deleting…'
                                  : 'Delete'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {bonusList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                            No bonus XP events yet. Create one to boost rider engagement.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {rejectionTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/30 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeRejectionDialog();
          }}
        >
          <div
            ref={rejectionDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="redemption-rejection-title"
            aria-describedby="redemption-rejection-description"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/20"
          >
            <div className="border-b border-emerald-100 bg-emerald-50/70 px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#08A65C] text-lg font-black text-white">
                  !
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#078448]">
                    Decision &amp; refund
                  </p>
                  <h2
                    id="redemption-rejection-title"
                    className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#07110D]"
                  >
                    Reject this reward request?
                  </h2>
                  <p
                    id="redemption-rejection-description"
                    className="mt-2 text-sm leading-6 text-[#5F6D65]"
                  >
                    The Rider&apos;s {rejectionTarget.pointsSpent.toLocaleString()} points and
                    reserved inventory will be restored. They will see the reason you provide.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">
              <div className="rounded-2xl border border-[#DCE9E2] bg-[#F8FBF9] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#76847C]">
                  Reward
                </p>
                <p className="mt-1 font-semibold text-[#07110D]">
                  {rejectionTarget.item?.icon ?? '🎁'} {rejectionTarget.item?.name ?? 'Reward item'}
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <label
                    htmlFor="redemption-rejection-reason"
                    className="text-sm font-semibold text-[#17221C]"
                  >
                    Rejection reason
                  </label>
                  <span className="text-xs tabular-nums text-[#76847C]">
                    {rejectionReason.trim().length}/500
                  </span>
                </div>
                <textarea
                  ref={rejectionReasonRef}
                  id="redemption-rejection-reason"
                  rows={4}
                  maxLength={500}
                  value={rejectionReason}
                  disabled={isMutationPending(`redemptions:decision:${rejectionTarget.id}`)}
                  onChange={(event) => {
                    setRejectionReason(event.target.value);
                    if (rejectionReasonError) setRejectionReasonError('');
                  }}
                  placeholder="Explain clearly why this request cannot be fulfilled…"
                  aria-invalid={Boolean(rejectionReasonError)}
                  aria-describedby={rejectionReasonError ? 'redemption-rejection-error' : undefined}
                  className="min-h-28 w-full resize-y rounded-2xl border border-[#C9D9D0] bg-white px-4 py-3 text-sm leading-6 text-[#07110D] outline-none transition focus:border-[#08A65C] focus:ring-4 focus:ring-emerald-100 disabled:cursor-wait disabled:bg-gray-50"
                />
                {rejectionReasonError && (
                  <p
                    id="redemption-rejection-error"
                    className="mt-2 text-sm font-medium text-red-600"
                  >
                    {rejectionReasonError}
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={closeRejectionDialog}
                  disabled={isMutationPending(`redemptions:decision:${rejectionTarget.id}`)}
                >
                  Keep pending
                </Button>
                <Button
                  onClick={submitRedemptionRejection}
                  disabled={isMutationPending(`redemptions:decision:${rejectionTarget.id}`)}
                  className="bg-[#07110D] text-white hover:bg-[#16231C]"
                >
                  {isMutationPending(`redemptions:decision:${rejectionTarget.id}`)
                    ? 'Rejecting & refunding…'
                    : 'Reject & refund points'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
