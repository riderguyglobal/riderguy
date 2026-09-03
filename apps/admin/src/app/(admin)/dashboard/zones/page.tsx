'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { getApiClient } from '@riderguy/auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
  Label,
  Separator,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@riderguy/ui';

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
  const newCurrency = 'GHS';
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
      const { data } = await getApiClient().get('/zones');
      setZones(data.data ?? []);
    } catch {
      setError('Failed to load zones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchZones();
  }, [fetchZones]);

  // ── Create zone ───────────────────────────────────────────
  const handleCreateZone = useCallback(async () => {
    if (!newName.trim()) {
      setError('Zone name is required.');
      return;
    }

    setActionLoading(true);
    try {
      const centerLat = Number(newCenterLat);
      const centerLng = Number(newCenterLng);
      if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
        throw new Error('Enter explicit Ghana centre coordinates before creating a zone.');
      }
      if (centerLat < 4.5 || centerLat > 11.2 || centerLng < -3.3 || centerLng > 1.3) {
        throw new Error('Zone coordinates must be within Ghana.');
      }

      // Create a small, closed starter boundary around the explicitly chosen
      // Ghana centre. It can be refined through the general zone update API.
      const d = 0.025;
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

      await getApiClient().post('/zones', body);

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
        await getApiClient().patch(`/zones/${zoneId}/${action}`);
        await fetchZones();
      } catch {
        setError('Failed to update zone status.');
      } finally {
        setActionLoading(false);
      }
    },
    [fetchZones],
  );

  // ── Update surge ──────────────────────────────────────────
  const handleUpdateSurge = useCallback(async () => {
    if (!surgeZoneId) return;

    setActionLoading(true);
    try {
      await getApiClient().patch(`/zones/${surgeZoneId}/surge`, {
        surgeMultiplier: parseFloat(surgeValue),
      });
      setSurgeZoneId(null);
      await fetchZones();
    } catch {
      setError('Failed to update surge multiplier.');
      setSurgeZoneId(null);
    } finally {
      setActionLoading(false);
    }
  }, [surgeZoneId, surgeValue, fetchZones]);

  return (
    <>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="admin-kicker">Coverage &amp; pricing</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-[#07110D]">
            Zone management
          </h1>
          <p className="mt-2 text-sm text-[#6E7A73]">
            Ghana-only delivery boundaries, pricing, and live demand controls.
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
          <Spinner className="text-brand-500 h-8 w-8" />
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
                placeholder="e.g. Accra Central"
                className="mt-1"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="centerLat">Center Latitude *</Label>
                <Input
                  id="centerLat"
                  type="number"
                  step="0.0001"
                  value={newCenterLat}
                  onChange={(e) => setNewCenterLat(e.target.value)}
                  placeholder="5.6037"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="centerLng">Center Longitude *</Label>
                <Input
                  id="centerLng"
                  type="number"
                  step="0.0001"
                  value={newCenterLng}
                  onChange={(e) => setNewCenterLng(e.target.value)}
                  placeholder="-0.1870"
                  className="mt-1"
                />
              </div>
            </div>

            <p className="rounded-xl border border-[#CFE8DB] bg-[#F0FBF6] px-4 py-3 text-xs leading-5 text-[#315B47]">
              Coordinates are required and validated against Ghana&apos;s bounds. A closed starter
              service boundary is created around this centre; review the impact before activation.
            </p>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              <Button variant="outline" onClick={() => setShowNewZone(false)}>
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
                      <span>
                        Base: {zone.currency} {zone.baseFare.toFixed(2)}
                      </span>
                      <span>
                        Per km: {zone.currency} {zone.perKmRate.toFixed(2)}
                      </span>
                      <span>
                        Min: {zone.currency} {zone.minimumFare.toFixed(2)}
                      </span>
                      <span>Commission: {zone.commissionRate}%</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {/* Surge button */}
                    <Dialog
                      open={surgeZoneId === zone.id}
                      onOpenChange={(open) => {
                        if (open) {
                          setSurgeZoneId(zone.id);
                          setSurgeValue(String(zone.surgeMultiplier));
                        } else if (!actionLoading) {
                          setSurgeZoneId(null);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
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
                          <Button
                            variant="outline"
                            disabled={actionLoading}
                            onClick={() => setSurgeZoneId(null)}
                          >
                            Cancel
                          </Button>
                          <Button onClick={() => void handleUpdateSurge()} disabled={actionLoading}>
                            Update Surge
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Toggle status */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleToggleStatus(zone.id, zone.status)}
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
