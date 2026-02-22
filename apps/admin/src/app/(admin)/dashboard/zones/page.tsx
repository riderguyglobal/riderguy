'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@riderguy/auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
  Label,
  Textarea,
  Separator,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@riderguy/ui';
import { API_BASE_URL } from '@/lib/constants';

// ─── Types ──────────────────────────────────────────────────

interface ZoneData {
  id: string;
  name: string;
  status: string;
  baseFare: number;
  perKmRate: number;
  minimumFare: number;
  surgeMultiplier: number;
  commissionRate: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Component ──────────────────────────────────────────────

export default function ZoneManagementPage() {
  const { accessToken } = useAuth();

  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // New zone form state
  const [showNewZone, setShowNewZone] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBaseFare, setNewBaseFare] = useState('15');
  const [newPerKm, setNewPerKm] = useState('5');
  const [newMinFare, setNewMinFare] = useState('20');
  const [newCommission, setNewCommission] = useState('15');
  const [newCurrency, setNewCurrency] = useState('NGN');
  const [newCenterLat, setNewCenterLat] = useState('');
  const [newCenterLng, setNewCenterLng] = useState('');

  // Surge update
  const [surgeZoneId, setSurgeZoneId] = useState<string | null>(null);
  const [surgeValue, setSurgeValue] = useState('1.0');

  // ── Fetch zones ───────────────────────────────────────────
  const fetchZones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/zones`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) throw new Error('Failed to load zones');
      const json = await res.json();
      setZones(json.data);
    } catch {
      setError('Failed to load zones.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchZones();
  }, [fetchZones]);

  // ── Create zone ───────────────────────────────────────────
  const handleCreateZone = useCallback(async () => {
    if (!newName.trim()) return;

    setActionLoading(true);
    try {
      const centerLat = parseFloat(newCenterLat) || -26.2041;
      const centerLng = parseFloat(newCenterLng) || 28.0473;

      // Generate a simple square polygon around center (for demo)
      const d = 0.05;
      const polygon = [
        [
          [centerLng - d, centerLat - d],
          [centerLng + d, centerLat - d],
          [centerLng + d, centerLat + d],
          [centerLng - d, centerLat + d],
          [centerLng - d, centerLat - d],
        ],
      ];

      const body = {
        name: newName.trim(),
        polygon,
        centerLatitude: centerLat,
        centerLongitude: centerLng,
        baseFare: parseFloat(newBaseFare),
        perKmRate: parseFloat(newPerKm),
        minimumFare: parseFloat(newMinFare),
        commissionRate: parseFloat(newCommission),
        currency: newCurrency,
      };

      const res = await fetch(`${API_BASE_URL}/zones`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to create zone');
      }

      setShowNewZone(false);
      setNewName('');
      setNewCenterLat('');
      setNewCenterLng('');
      await fetchZones();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create zone.');
    } finally {
      setActionLoading(false);
    }
  }, [
    accessToken,
    newName,
    newBaseFare,
    newPerKm,
    newMinFare,
    newCommission,
    newCurrency,
    newCenterLat,
    newCenterLng,
    fetchZones,
  ]);

  // ── Toggle zone status ────────────────────────────────────
  const handleToggleStatus = useCallback(
    async (zoneId: string, currentStatus: string) => {
      setActionLoading(true);
      try {
        const action = currentStatus === 'ACTIVE' ? 'deactivate' : 'activate';
        const res = await fetch(`${API_BASE_URL}/zones/${zoneId}/${action}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!res.ok) throw new Error('Failed to update zone status');
        await fetchZones();
      } catch {
        setError('Failed to update zone status.');
      } finally {
        setActionLoading(false);
      }
    },
    [accessToken, fetchZones],
  );

  // ── Update surge ──────────────────────────────────────────
  const handleUpdateSurge = useCallback(async () => {
    if (!surgeZoneId) return;

    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/zones/${surgeZoneId}/surge`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ surgeMultiplier: parseFloat(surgeValue) }),
      });

      if (!res.ok) throw new Error('Failed to update surge');
      setSurgeZoneId(null);
      await fetchZones();
    } catch {
      setError('Failed to update surge multiplier.');
    } finally {
      setActionLoading(false);
    }
  }, [accessToken, surgeZoneId, surgeValue, fetchZones]);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zone Management</h1>
          <p className="text-sm text-gray-500">
            Manage delivery zones, pricing, and surge multipliers.
          </p>
        </div>
        <Button onClick={() => setShowNewZone(true)}>+ Create Zone</Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      )}

      {/* New zone form */}
      {showNewZone && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm text-gray-500">Create New Zone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="zoneName">Zone Name *</Label>
              <Input
                id="zoneName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Johannesburg CBD"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="centerLat">Center Latitude</Label>
                <Input
                  id="centerLat"
                  type="number"
                  step="0.0001"
                  value={newCenterLat}
                  onChange={(e) => setNewCenterLat(e.target.value)}
                  placeholder="-26.2041"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="centerLng">Center Longitude</Label>
                <Input
                  id="centerLng"
                  type="number"
                  step="0.0001"
                  value={newCenterLng}
                  onChange={(e) => setNewCenterLng(e.target.value)}
                  placeholder="28.0473"
                  className="mt-1"
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label htmlFor="baseFare">Base Fare</Label>
                <Input
                  id="baseFare"
                  type="number"
                  step="0.5"
                  value={newBaseFare}
                  onChange={(e) => setNewBaseFare(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="perKm">Per Km Rate</Label>
                <Input
                  id="perKm"
                  type="number"
                  step="0.5"
                  value={newPerKm}
                  onChange={(e) => setNewPerKm(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="minFare">Minimum Fare</Label>
                <Input
                  id="minFare"
                  type="number"
                  step="0.5"
                  value={newMinFare}
                  onChange={(e) => setNewMinFare(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="commission">Commission %</Label>
                <Input
                  id="commission"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={newCommission}
                  onChange={(e) => setNewCommission(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowNewZone(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void handleCreateZone()}
                disabled={actionLoading || !newName.trim()}
              >
                {actionLoading ? 'Creating…' : 'Create Zone'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zones list */}
      {!loading && zones.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-lg font-medium text-gray-400">No zones configured</p>
            <p className="mt-1 text-sm text-gray-300">
              Create your first delivery zone to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && zones.length > 0 && (
        <div className="space-y-3">
          {zones.map((zone) => (
            <Card key={zone.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{zone.name}</h3>
                      <Badge
                        className={
                          zone.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                        }
                      >
                        {zone.status}
                      </Badge>
                      {zone.surgeMultiplier > 1 && (
                        <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                          ⚡ {zone.surgeMultiplier}x Surge
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                      <span>Base: {zone.currency} {zone.baseFare.toFixed(2)}</span>
                      <span>Per km: {zone.currency} {zone.perKmRate.toFixed(2)}</span>
                      <span>Min: {zone.currency} {zone.minimumFare.toFixed(2)}</span>
                      <span>Commission: {zone.commissionRate}%</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {/* Surge button */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSurgeZoneId(zone.id);
                            setSurgeValue(String(zone.surgeMultiplier));
                          }}
                        >
                          ⚡ Surge
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Update Surge — {zone.name}</DialogTitle>
                          <DialogDescription>
                            Set the surge multiplier (1.0 = no surge, max 5.0)
                          </DialogDescription>
                        </DialogHeader>
                        <div>
                          <Label htmlFor="surgeInput">Surge Multiplier</Label>
                          <Input
                            id="surgeInput"
                            type="number"
                            step="0.1"
                            min="1"
                            max="5"
                            value={surgeValue}
                            onChange={(e) => setSurgeValue(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <Button
                            onClick={() => void handleUpdateSurge()}
                            disabled={actionLoading}
                          >
                            Update Surge
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Toggle status */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void handleToggleStatus(zone.id, zone.status)
                      }
                      disabled={actionLoading}
                    >
                      {zone.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
