'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from './auth-provider';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Spinner } from '@riderguy/ui';

// ============================================================
// Settings / Security — active sessions list + revoke
// Shared component used by rider, client, and admin apps.
// ============================================================

interface Session {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export function SessionManager() {
  const { api } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/sessions');
      setSessions(data.data ?? []);
    } catch {
      // ignore — user may not have sessions
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = useCallback(
    async (sessionId: string) => {
      setRevoking(sessionId);
      try {
        await api.delete(`/auth/sessions/${sessionId}`);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } catch {
        // ignore
      } finally {
        setRevoking(null);
      }
    },
    [api]
  );

  const handleRevokeAll = useCallback(async () => {
    setRevoking('all');
    try {
      await api.delete('/auth/sessions');
      await fetchSessions(); // refresh — current session remains
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  }, [api, fetchSessions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6 text-brand-500" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Active Sessions</CardTitle>
          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeAll}
              disabled={revoking === 'all'}
            >
              {revoking === 'all' ? 'Revoking…' : 'Revoke All Others'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400">No active sessions found.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((session, index) => (
              <div
                key={session.id}
                className="flex items-start justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">
                      {session.deviceInfo
                        ? session.deviceInfo.substring(0, 60)
                        : 'Unknown Device'}
                      {session.deviceInfo && session.deviceInfo.length > 60 && '…'}
                    </p>
                    {index === 0 && (
                      <Badge className="text-xs">Current</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {session.ipAddress ?? 'Unknown IP'} · Started{' '}
                    {new Date(session.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {index !== 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => handleRevoke(session.id)}
                    disabled={revoking === session.id}
                  >
                    {revoking === session.id ? '…' : 'Revoke'}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
