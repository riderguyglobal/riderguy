'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { getApiClient } from '@riderguy/auth';
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

interface RiderGamification {
  riderId: string;
  totalXp: number;
  currentLevel: number;
  levelName: string;
  progressPercent: number;
  badges: Array<{
    id: string;
    name: string;
    icon: string;
    awardedAt: string;
  }>;
  recentXpEvents: Array<{
    id: string;
    action: string;
    points: number;
    createdAt: string;
  }>;
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

export default function GamificationAdminPage() {
  const [tab, setTab] = useState<AdminTab>('badges');
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Challenge state
  const [challengesList, setChallengesList] = useState<ChallengeItem[]>([]);
  const [challengesLoading, setChallengesLoading] = useState(false);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<ChallengeItem | null>(null);
  const [challengeForm, setChallengeForm] = useState({
    title: '', description: '', icon: '🎯', type: 'DAILY',
    criteriaAction: 'delivery_complete', criteriaCount: 5,
    xpReward: 100, pointsReward: 50, minLevel: '', maxLevel: '',
    startsAt: '', endsAt: '',
  });

  // Rewards state
  const [rewardsList, setRewardsList] = useState<RewardStoreItem[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingReward, setEditingReward] = useState<RewardStoreItem | null>(null);
  const [rewardForm, setRewardForm] = useState({
    name: '', description: '', icon: '🎁', category: 'merchandise',
    pointsCost: 100, inventory: -1, isFeatured: false,
  });
  const [redemptionsList, setRedemptionsList] = useState<RedemptionItem[]>([]);
  const [rewardsSubTab, setRewardsSubTab] = useState<'items' | 'redemptions'>('items');

  // Bonus XP state
  const [bonusList, setBonusList] = useState<BonusXpEvent[]>([]);
  const [bonusLoading, setBonusLoading] = useState(false);
  const [showBonusForm, setShowBonusForm] = useState(false);
  const [editingBonus, setEditingBonus] = useState<BonusXpEvent | null>(null);
  const [bonusForm, setBonusForm] = useState({
    title: '', description: '', multiplier: 2, targetActions: 'delivery_complete',
    startsAt: '', endsAt: '',
  });

  // Badge form
  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [editingBadge, setEditingBadge] = useState<BadgeItem | null>(null);
  const [badgeForm, setBadgeForm] = useState({
    slug: '', name: '', description: '', icon: '🏆', category: 'achievement',
    xpReward: 0, sortOrder: 0, criteriaAction: '', criteriaThreshold: 0,
  });

  // Rider lookup
  const [riderId, setRiderId] = useState('');
  const [riderProfile, setRiderProfile] = useState<RiderGamification | null>(null);
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
    try {
      const api = getApiClient();
      await api.post('/gamification/admin/seed-badges');
      setSuccess('Default badges seeded successfully!');
      fetchBadges();
    } catch {
      setError('Failed to seed badges');
    }
  };

  // ── Create / Update badge ──
  const handleSaveBadge = async () => {
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
      fetchBadges();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save badge');
    }
  };

  // ── Delete badge ──
  const handleDeleteBadge = async (badgeId: string) => {
    if (!confirm('Delete this badge? This cannot be undone.')) return;
    try {
      const api = getApiClient();
      await api.delete(`/gamification/admin/badges/${badgeId}`);
      setSuccess('Badge deleted');
      fetchBadges();
    } catch {
      setError('Failed to delete badge');
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
      slug: '', name: '', description: '', icon: '🏆', category: 'achievement',
      xpReward: 0, sortOrder: 0, criteriaAction: '', criteriaThreshold: 0,
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
    }
  };

  // Clear messages after 4s
  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(''); setError(''); }, 4000);
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
    try {
      const api = getApiClient();
      const payload: Record<string, unknown> = {
        title: challengeForm.title,
        description: challengeForm.description,
        icon: challengeForm.icon,
        type: challengeForm.type,
        criteriaAction: challengeForm.criteriaAction,
        criteriaCount: challengeForm.criteriaCount,
        xpReward: challengeForm.xpReward,
        pointsReward: challengeForm.pointsReward,
        startsAt: challengeForm.startsAt || new Date().toISOString(),
        endsAt: challengeForm.endsAt,
      };
      if (challengeForm.minLevel) payload.minLevel = parseInt(challengeForm.minLevel);
      if (challengeForm.maxLevel) payload.maxLevel = parseInt(challengeForm.maxLevel);

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
      fetchChallenges();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save challenge');
    }
  };

  const handleEditChallenge = (c: ChallengeItem) => {
    setEditingChallenge(c);
    setChallengeForm({
      title: c.title, description: c.description, icon: c.icon, type: c.type,
      criteriaAction: c.criteriaAction, criteriaCount: c.criteriaCount,
      xpReward: c.xpReward, pointsReward: c.pointsReward,
      minLevel: c.minLevel?.toString() ?? '', maxLevel: c.maxLevel?.toString() ?? '',
      startsAt: c.startsAt?.slice(0, 16) ?? '', endsAt: c.endsAt?.slice(0, 16) ?? '',
    });
    setShowChallengeForm(true);
  };

  const handleDeleteChallenge = async (id: string) => {
    if (!confirm('Delete this challenge?')) return;
    try {
      const api = getApiClient();
      await api.delete(`/gamification/admin/challenges/${id}`);
      setSuccess('Challenge deleted');
      fetchChallenges();
    } catch { setError('Failed to delete challenge'); }
  };

  const resetChallengeForm = () => {
    setChallengeForm({
      title: '', description: '', icon: '🎯', type: 'DAILY',
      criteriaAction: 'delivery_complete', criteriaCount: 5,
      xpReward: 100, pointsReward: 50, minLevel: '', maxLevel: '',
      startsAt: '', endsAt: '',
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
      fetchRewards();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save reward');
    }
  };

  const handleEditReward = (r: RewardStoreItem) => {
    setEditingReward(r);
    setRewardForm({
      name: r.name, description: r.description, icon: r.icon, category: r.category,
      pointsCost: r.pointsCost, inventory: r.inventory, isFeatured: r.isFeatured,
    });
    setShowRewardForm(true);
  };

  const handleDeleteReward = async (id: string) => {
    if (!confirm('Delete this reward item?')) return;
    try {
      const api = getApiClient();
      await api.delete(`/gamification/admin/rewards/${id}`);
      setSuccess('Reward deleted');
      fetchRewards();
    } catch { setError('Failed to delete reward'); }
  };

  const handleUpdateRedemption = async (redemptionId: string, status: string) => {
    try {
      const api = getApiClient();
      await api.put(`/gamification/admin/redemptions/${redemptionId}`, { status });
      setSuccess(`Redemption ${status.toLowerCase()}`);
      fetchRedemptions();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to update redemption');
    }
  };

  const resetRewardForm = () => {
    setRewardForm({
      name: '', description: '', icon: '🎁', category: 'merchandise',
      pointsCost: 100, inventory: -1, isFeatured: false,
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
    try {
      const api = getApiClient();
      const payload = {
        title: bonusForm.title,
        description: bonusForm.description,
        multiplier: bonusForm.multiplier,
        targetActions: bonusForm.targetActions.split(',').map(a => a.trim()).filter(Boolean),
        startsAt: bonusForm.startsAt || new Date().toISOString(),
        endsAt: bonusForm.endsAt,
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
      fetchBonusEvents();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save bonus event');
    }
  };

  const handleEditBonus = (b: BonusXpEvent) => {
    setEditingBonus(b);
    setBonusForm({
      title: b.title, description: b.description, multiplier: b.multiplier,
      targetActions: b.targetActions.join(', '),
      startsAt: b.startsAt?.slice(0, 16) ?? '', endsAt: b.endsAt?.slice(0, 16) ?? '',
    });
    setShowBonusForm(true);
  };

  const handleDeleteBonus = async (id: string) => {
    if (!confirm('Delete this bonus XP event?')) return;
    try {
      const api = getApiClient();
      await api.delete(`/gamification/admin/bonus-events/${id}`);
      setSuccess('Bonus event deleted');
      fetchBonusEvents();
    } catch { setError('Failed to delete bonus event'); }
  };

  const resetBonusForm = () => {
    setBonusForm({
      title: '', description: '', multiplier: 2, targetActions: 'delivery_complete',
      startsAt: '', endsAt: '',
    });
  };

  // Fetch data when tabs switch
  useEffect(() => {
    if (tab === 'challenges') fetchChallenges();
    if (tab === 'rewards') { fetchRewards(); fetchRedemptions(); }
    if (tab === 'bonus-xp') fetchBonusEvents();
  }, [tab, fetchChallenges, fetchRewards, fetchRedemptions, fetchBonusEvents]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gamification</h1>
          <p className="text-sm text-gray-500 mt-1">Manage badges, challenges, rewards, XP events & rider levels</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeedBadges}>
            Seed Default Badges
          </Button>
        </div>
      </div>

      {/* Status messages */}
      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {([
          { key: 'badges' as AdminTab, label: 'Badges' },
          { key: 'challenges' as AdminTab, label: 'Challenges' },
          { key: 'rewards' as AdminTab, label: 'Rewards Store' },
          { key: 'bonus-xp' as AdminTab, label: 'Bonus XP' },
          { key: 'rider-lookup' as AdminTab, label: 'Rider Lookup' },
          { key: 'award-xp' as AdminTab, label: 'Award XP' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                    <Input
                      value={badgeForm.slug}
                      onChange={(e) => setBadgeForm(p => ({ ...p, slug: e.target.value }))}
                      placeholder="first_delivery"
                      disabled={!!editingBadge}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <Input
                      value={badgeForm.name}
                      onChange={(e) => setBadgeForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="First Delivery"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <Input
                    value={badgeForm.description}
                    onChange={(e) => setBadgeForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Complete your first delivery"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                    <Input
                      value={badgeForm.icon}
                      onChange={(e) => setBadgeForm(p => ({ ...p, icon: e.target.value }))}
                      placeholder="🏆"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={badgeForm.category}
                      onChange={(e) => setBadgeForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                    >
                      <option value="milestone">Milestone</option>
                      <option value="achievement">Achievement</option>
                      <option value="special">Special</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">XP Reward</label>
                    <Input
                      type="number"
                      value={badgeForm.xpReward}
                      onChange={(e) => setBadgeForm(p => ({ ...p, xpReward: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                    <Input
                      type="number"
                      value={badgeForm.sortOrder}
                      onChange={(e) => setBadgeForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Action (optional)</label>
                    <select
                      value={badgeForm.criteriaAction}
                      onChange={(e) => setBadgeForm(p => ({ ...p, criteriaAction: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Threshold</label>
                    <Input
                      type="number"
                      value={badgeForm.criteriaThreshold}
                      onChange={(e) => setBadgeForm(p => ({ ...p, criteriaThreshold: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveBadge}>
                    {editingBadge ? 'Update' : 'Create'}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowBadgeForm(false); setEditingBadge(null); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Badges table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6 text-brand-500" />
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Badge</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">XP</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criteria</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Earned By</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {badges.map((badge) => (
                      <tr key={badge.id} className="hover:bg-gray-50/50 transition-colors">
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
                          <UIBadge className={
                            badge.category === 'milestone' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                            badge.category === 'special' ? 'bg-purple-100 text-purple-800 hover:bg-purple-100' :
                            'bg-gray-100 text-gray-700 hover:bg-gray-100'
                          }>
                            {badge.category}
                          </UIBadge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-medium tabular-nums">+{badge.xpReward}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {badge.criteria?.action
                            ? `${badge.criteria.action} × ${badge.criteria.threshold}`
                            : <span className="text-gray-400">Manual</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{badge._count?.riders ?? 0}</td>
                        <td className="px-4 py-3">
                          <UIBadge className={badge.isActive ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'}>
                            {badge.isActive ? 'Active' : 'Inactive'}
                          </UIBadge>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditBadge(badge)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteBadge(badge.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {badges.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                          No badges yet. Click &quot;Seed Default Badges&quot; to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="rounded-lg bg-blue-50 p-4 text-center">
                    <p className="text-2xl font-bold text-blue-700">{riderProfile.totalXp.toLocaleString()}</p>
                    <p className="text-xs text-blue-600 mt-1">Total XP</p>
                  </div>
                  <div className="rounded-lg bg-purple-50 p-4 text-center">
                    <p className="text-2xl font-bold text-purple-700">Level {riderProfile.currentLevel}</p>
                    <p className="text-xs text-purple-600 mt-1">{riderProfile.levelName}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-4 text-center">
                    <p className="text-2xl font-bold text-amber-700">{riderProfile.badges.length}</p>
                    <p className="text-xs text-amber-600 mt-1">Badges Earned</p>
                  </div>

                  {/* Progress bar */}
                  <div className="col-span-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Level Progress</span>
                      <span>{Math.round(riderProfile.progressPercent)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                        style={{ width: `${riderProfile.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Badges */}
                  {riderProfile.badges.length > 0 && (
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Earned Badges</p>
                      <div className="flex flex-wrap gap-2">
                        {riderProfile.badges.map((b) => (
                          <div key={b.id} className="flex items-center gap-1.5 bg-gray-50 border rounded-full px-3 py-1.5">
                            <span>{b.icon}</span>
                            <span className="text-xs font-medium text-gray-700">{b.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent XP events */}
                  {riderProfile.recentXpEvents.length > 0 && (
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Recent XP Events</p>
                      <div className="divide-y border rounded-lg overflow-hidden">
                        {riderProfile.recentXpEvents.slice(0, 10).map((evt) => (
                          <div key={evt.id} className="flex items-center justify-between px-3 py-2 text-sm">
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
          <CardContent className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rider Profile ID</label>
              <Input
                value={awardRiderId}
                onChange={(e) => setAwardRiderId(e.target.value)}
                placeholder="Enter rider profile ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
              <Input
                type="number"
                min={1}
                max={10000}
                value={awardPoints}
                onChange={(e) => setAwardPoints(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <Input
                value={awardReason}
                onChange={(e) => setAwardReason(e.target.value)}
                placeholder="e.g., Bonus for excellent service"
              />
            </div>
            <Button onClick={handleAwardXp} disabled={!awardRiderId || !awardReason || awardPoints < 1}>
              Award {awardPoints} XP
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
              onClick={() => { setEditingChallenge(null); resetChallengeForm(); setShowChallengeForm(true); }}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <Input
                      value={challengeForm.title}
                      onChange={(e) => setChallengeForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Complete 10 Deliveries"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                    <Input
                      value={challengeForm.icon}
                      onChange={(e) => setChallengeForm(p => ({ ...p, icon: e.target.value }))}
                      placeholder="🎯"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <Input
                    value={challengeForm.description}
                    onChange={(e) => setChallengeForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Complete 10 deliveries today to earn bonus XP"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={challengeForm.type}
                      onChange={(e) => setChallengeForm(p => ({ ...p, type: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="CUSTOM">Custom</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Action</label>
                    <select
                      value={challengeForm.criteriaAction}
                      onChange={(e) => setChallengeForm(p => ({ ...p, criteriaAction: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                    >
                      <option value="delivery_complete">Delivery Complete</option>
                      <option value="on_time_delivery">On-Time Delivery</option>
                      <option value="five_star_rating">5-Star Rating</option>
                      <option value="referral">Referral</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Criteria Count</label>
                    <Input
                      type="number"
                      min={1}
                      value={challengeForm.criteriaCount}
                      onChange={(e) => setChallengeForm(p => ({ ...p, criteriaCount: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">XP Reward</label>
                    <Input
                      type="number"
                      value={challengeForm.xpReward}
                      onChange={(e) => setChallengeForm(p => ({ ...p, xpReward: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points Reward</label>
                    <Input
                      type="number"
                      value={challengeForm.pointsReward}
                      onChange={(e) => setChallengeForm(p => ({ ...p, pointsReward: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Level</label>
                    <Input
                      type="number"
                      min={1} max={7}
                      value={challengeForm.minLevel}
                      onChange={(e) => setChallengeForm(p => ({ ...p, minLevel: e.target.value }))}
                      placeholder="Any"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Level</label>
                    <Input
                      type="number"
                      min={1} max={7}
                      value={challengeForm.maxLevel}
                      onChange={(e) => setChallengeForm(p => ({ ...p, maxLevel: e.target.value }))}
                      placeholder="Any"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Starts At</label>
                    <Input
                      type="datetime-local"
                      value={challengeForm.startsAt}
                      onChange={(e) => setChallengeForm(p => ({ ...p, startsAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ends At</label>
                    <Input
                      type="datetime-local"
                      value={challengeForm.endsAt}
                      onChange={(e) => setChallengeForm(p => ({ ...p, endsAt: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveChallenge}>
                    {editingChallenge ? 'Update' : 'Create'}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowChallengeForm(false); setEditingChallenge(null); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Challenges table */}
          {challengesLoading ? (
            <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-500" /></div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Challenge</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Goal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rewards</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Participants</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ends</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {challengesList.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{c.icon}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{c.title}</p>
                              <p className="text-xs text-gray-500 max-w-xs truncate">{c.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <UIBadge className={
                            c.type === 'DAILY' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' :
                            c.type === 'WEEKLY' ? 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100' :
                            c.type === 'MONTHLY' ? 'bg-purple-100 text-purple-800 hover:bg-purple-100' :
                            'bg-gray-100 text-gray-700 hover:bg-gray-100'
                          }>
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
                        <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                          {c._count?.participants ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          <UIBadge className={
                            c.status === 'ACTIVE' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                            c.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                            c.status === 'EXPIRED' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                            c.status === 'DRAFT' ? 'bg-gray-100 text-gray-600 hover:bg-gray-100' :
                            'bg-red-100 text-red-700 hover:bg-red-100'
                          }>
                            {c.status}
                          </UIBadge>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(c.endsAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditChallenge(c)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteChallenge(c.id)}>Delete</Button>
                        </td>
                      </tr>
                    ))}
                    {challengesList.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm">
                          No challenges yet. Create one to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                rewardsSubTab === 'items'
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Store Items
            </button>
            <button
              onClick={() => setRewardsSubTab('redemptions')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
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
                  onClick={() => { setEditingReward(null); resetRewardForm(); setShowRewardForm(true); }}
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <Input
                          value={rewardForm.name}
                          onChange={(e) => setRewardForm(p => ({ ...p, name: e.target.value }))}
                          placeholder="Riderguy T-Shirt"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                        <Input
                          value={rewardForm.icon}
                          onChange={(e) => setRewardForm(p => ({ ...p, icon: e.target.value }))}
                          placeholder="👕"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <Input
                        value={rewardForm.description}
                        onChange={(e) => setRewardForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Official Riderguy branded t-shirt"
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                          value={rewardForm.category}
                          onChange={(e) => setRewardForm(p => ({ ...p, category: e.target.value }))}
                          className="w-full rounded-md border border-gray-300 py-2 px-3 text-sm"
                        >
                          <option value="merchandise">Merchandise</option>
                          <option value="voucher">Voucher</option>
                          <option value="perk">Perk</option>
                          <option value="digital">Digital</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Points Cost</label>
                        <Input
                          type="number"
                          min={1}
                          value={rewardForm.pointsCost}
                          onChange={(e) => setRewardForm(p => ({ ...p, pointsCost: parseInt(e.target.value) || 1 }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Inventory</label>
                        <Input
                          type="number"
                          min={-1}
                          value={rewardForm.inventory}
                          onChange={(e) => setRewardForm(p => ({ ...p, inventory: parseInt(e.target.value) ?? -1 }))}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">-1 = unlimited</p>
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={rewardForm.isFeatured}
                            onChange={(e) => setRewardForm(p => ({ ...p, isFeatured: e.target.checked }))}
                            className="rounded border-gray-300"
                          />
                          Featured
                        </label>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button onClick={handleSaveReward}>
                        {editingReward ? 'Update' : 'Create'}
                      </Button>
                      <Button variant="outline" onClick={() => { setShowRewardForm(false); setEditingReward(null); }}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rewards table */}
              {rewardsLoading ? (
                <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-500" /></div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-gray-50/50">
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Inventory</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Redeemed</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rewardsList.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xl">{r.icon}</span>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{r.name}</p>
                                  <p className="text-xs text-gray-500 max-w-xs truncate">{r.description}</p>
                                </div>
                                {r.isFeatured && (
                                  <UIBadge className="bg-amber-100 text-amber-700 hover:bg-amber-100">⭐ Featured</UIBadge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <UIBadge className="bg-gray-100 text-gray-700 hover:bg-gray-100 capitalize">
                                {r.category}
                              </UIBadge>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-medium tabular-nums">{r.pointsCost.toLocaleString()} pts</td>
                            <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                              {r.inventory === -1 ? '∞' : r.inventory}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{r._count?.redemptions ?? 0}</td>
                            <td className="px-4 py-3">
                              <UIBadge className={r.isActive ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-100'}>
                                {r.isActive ? 'Active' : 'Inactive'}
                              </UIBadge>
                            </td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEditReward(r)}>Edit</Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteReward(r.id)}>Delete</Button>
                            </td>
                          </tr>
                        ))}
                        {rewardsList.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                              No reward items yet. Add one to get started.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rider</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {redemptionsList.map((r) => {
                      const riderName = r.rider?.user
                        ? `${r.rider.user.firstName} ${r.rider.user.lastName}`
                        : r.riderId.slice(0, 8);
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-700">{riderName}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span>{r.item?.icon ?? '🎁'}</span>
                              <span className="text-sm text-gray-700">{r.item?.name ?? 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">{r.pointsSpent}</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <UIBadge className={
                              r.status === 'PENDING' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                              r.status === 'APPROVED' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                              r.status === 'FULFILLED' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                              r.status === 'REJECTED' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                              'bg-gray-100 text-gray-500 hover:bg-gray-100'
                            }>
                              {r.status}
                            </UIBadge>
                          </td>
                          <td className="px-4 py-3 text-right space-x-1">
                            {r.status === 'PENDING' && (
                              <>
                                <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleUpdateRedemption(r.id, 'APPROVED')}>
                                  Approve
                                </Button>
                                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleUpdateRedemption(r.id, 'REJECTED')}>
                                  Reject
                                </Button>
                              </>
                            )}
                            {r.status === 'APPROVED' && (
                              <Button variant="ghost" size="sm" className="text-green-600" onClick={() => handleUpdateRedemption(r.id, 'FULFILLED')}>
                                Mark Fulfilled
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {redemptionsList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                          No redemptions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
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
              onClick={() => { setEditingBonus(null); resetBonusForm(); setShowBonusForm(true); }}
            >
              + Create Bonus XP Event
            </Button>
          </div>

          {/* Bonus form */}
          {showBonusForm && (
            <Card>
              <CardHeader>
                <CardTitle>{editingBonus ? 'Edit Bonus XP Event' : 'Create Bonus XP Event'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <Input
                      value={bonusForm.title}
                      onChange={(e) => setBonusForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Double XP Weekend"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Multiplier</label>
                    <Input
                      type="number"
                      min={1.1} step={0.1} max={10}
                      value={bonusForm.multiplier}
                      onChange={(e) => setBonusForm(p => ({ ...p, multiplier: parseFloat(e.target.value) || 2 }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <Input
                    value={bonusForm.description}
                    onChange={(e) => setBonusForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Earn double XP on all deliveries this weekend!"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Actions (comma-separated)</label>
                  <Input
                    value={bonusForm.targetActions}
                    onChange={(e) => setBonusForm(p => ({ ...p, targetActions: e.target.value }))}
                    placeholder="delivery_complete, on_time_delivery"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Leave empty for all actions</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Starts At</label>
                    <Input
                      type="datetime-local"
                      value={bonusForm.startsAt}
                      onChange={(e) => setBonusForm(p => ({ ...p, startsAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ends At</label>
                    <Input
                      type="datetime-local"
                      value={bonusForm.endsAt}
                      onChange={(e) => setBonusForm(p => ({ ...p, endsAt: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveBonus}>
                    {editingBonus ? 'Update' : 'Create'}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowBonusForm(false); setEditingBonus(null); }}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Bonus events table */}
          {bonusLoading ? (
            <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-brand-500" /></div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Multiplier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Schedule</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
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
                        <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{b.title}</p>
                            <p className="text-xs text-gray-500 max-w-xs truncate">{b.description}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-purple-600">{b.multiplier}×</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {b.targetActions.length > 0
                              ? b.targetActions.map(a => a.replace(/_/g, ' ')).join(', ')
                              : <span className="text-gray-400">All actions</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            <div>{new Date(b.startsAt).toLocaleDateString()} – {new Date(b.endsAt).toLocaleDateString()}</div>
                          </td>
                          <td className="px-4 py-3">
                            <UIBadge className={
                              isLive ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                              isUpcoming ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                              !b.isActive ? 'bg-gray-100 text-gray-500 hover:bg-gray-100' :
                              'bg-amber-100 text-amber-700 hover:bg-amber-100'
                            }>
                              {isLive ? '🔴 LIVE' : isUpcoming ? 'Upcoming' : !b.isActive ? 'Disabled' : 'Expired'}
                            </UIBadge>
                          </td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditBonus(b)}>Edit</Button>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDeleteBonus(b.id)}>Delete</Button>
                          </td>
                        </tr>
                      );
                    })}
                    {bonusList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                          No bonus XP events yet. Create one to boost rider engagement.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}    </div>
  );
}