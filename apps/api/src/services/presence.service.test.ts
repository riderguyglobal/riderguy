import { afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '@riderguy/database';

vi.mock('../lib/redis', () => ({
  getRedisClient: vi.fn(() => null),
}));

import {
  resolveOnlineSessionStartedAt,
  riderConnected,
  stopPresenceManager,
} from './presence.service';

const asMock = (value: unknown) => value as ReturnType<typeof vi.fn>;

afterEach(async () => {
  await stopPresenceManager();
  vi.clearAllMocks();
});

describe('Rider presence session truth', () => {
  it('preserves an existing server session start', () => {
    const existing = new Date('2026-08-31T08:15:00.000Z');
    const later = new Date('2026-08-31T09:00:00.000Z');

    expect(resolveOnlineSessionStartedAt(existing, later)).toBe(existing);
  });

  it('establishes a session start when an online profile has none', () => {
    const now = new Date('2026-08-31T09:00:00.000Z');

    expect(resolveOnlineSessionStartedAt(null, now)).toBe(now);
  });

  it('keeps the database session start when the Rider socket reconnects', async () => {
    const existing = new Date('2026-08-31T08:15:00.000Z');
    asMock(prisma.riderProfile.findUnique).mockResolvedValue({
      id: 'rider-profile-1',
      availability: 'ONLINE',
      sessionStartedAt: existing,
      totalOnlineSeconds: 120,
      currentLatitude: 5.6037,
      currentLongitude: -0.187,
    });
    asMock(prisma.riderProfile.update).mockResolvedValue({});

    await riderConnected('rider-user-1', 'socket-reconnect-1');

    expect(prisma.riderProfile.update).toHaveBeenCalledWith({
      where: { userId: 'rider-user-1' },
      data: expect.objectContaining({
        socketId: 'socket-reconnect-1',
        sessionStartedAt: existing,
      }),
    });
  });
});
