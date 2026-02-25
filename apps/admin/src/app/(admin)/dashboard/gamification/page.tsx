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

// ─── Main Page ──────────────────────────────────────────────

export default function GamificationAdminPage() {
  const [tab, setTab] = useState<'badges' | 'rider-lookup' | 'award-xp'>('badges');
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gamification</h1>
          <p className="text-sm text-gray-500 mt-1">Manage badges, XP, and rider levels</p>
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
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'badges', label: 'Badge Management' },
          { key: 'rider-lookup', label: 'Rider Lookup' },
          { key: 'award-xp', label: 'Award XP' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
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
    </div>
  );
}
