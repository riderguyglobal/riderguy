import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    event: { findMany: vi.fn(), count: vi.fn() },
    riderProfile: { findUnique: vi.fn() },
  },
  tx: {
    event: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  recordAudit: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@riderguy/database', () => ({ prisma: mocks.prisma }));
vi.mock('./admin-audit.service', () => ({
  AdminAuditService: { record: mocks.recordAudit },
}));
vi.mock('../lib/logger', () => ({ logger: { info: mocks.loggerInfo } }));

import { createEvent, listEvents, updateEvent } from './event.service';

interface EventRecord {
  id: string;
  title: string;
  description: string;
  type: 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  date: Date;
  endDate: Date | null;
  location: string | null;
  virtualLink: string | null;
  imageUrl: string | null;
  zoneId: string | null;
  capacity: number | null;
  createdById: string;
  updatedAt: Date;
}

const auditContext = {
  actorUserId: 'admin-1',
  ipAddress: '127.0.0.1',
  userAgent: 'vitest',
};

let storedEvent: EventRecord | null;
let auditRows: number;
let failAudit: boolean;

function eventRecord(): EventRecord {
  return {
    id: 'event-1',
    title: 'Rider safety workshop',
    description: 'Practical road safety training for active Riders.',
    type: 'IN_PERSON',
    status: 'UPCOMING',
    date: new Date('2099-10-01T10:00:00.000Z'),
    endDate: new Date('2099-10-01T12:00:00.000Z'),
    location: 'Accra',
    virtualLink: null,
    imageUrl: null,
    zoneId: 'zone-accra',
    capacity: 50,
    createdById: 'rider-owner-1',
    updatedAt: new Date('2026-09-03T00:00:00.000Z'),
  };
}

function installStatefulTransaction() {
  mocks.tx.event.findUnique.mockImplementation(async () =>
    storedEvent ? { ...storedEvent } : null,
  );
  mocks.tx.event.create.mockImplementation(
    async ({ data }: { data: Omit<EventRecord, 'id' | 'status' | 'updatedAt'> }) => {
      storedEvent = {
        ...eventRecord(),
        ...data,
        id: 'event-created',
        status: 'UPCOMING',
        updatedAt: new Date('2026-09-03T00:00:00.000Z'),
      };
      return { ...storedEvent };
    },
  );
  mocks.tx.event.updateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where: { id: string; status: string; updatedAt: Date };
      data: Partial<EventRecord>;
    }) => {
      if (
        !storedEvent ||
        where.id !== storedEvent.id ||
        where.status !== storedEvent.status ||
        where.updatedAt.getTime() !== storedEvent.updatedAt.getTime()
      ) {
        return { count: 0 };
      }
      storedEvent = {
        ...storedEvent,
        ...data,
        updatedAt: new Date(storedEvent.updatedAt.getTime() + 1000),
      };
      return { count: 1 };
    },
  );
  mocks.recordAudit.mockImplementation(async () => {
    if (failAudit) throw new Error('audit unavailable');
    auditRows += 1;
    return { id: `audit-${auditRows}` };
  });
  mocks.prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof mocks.tx) => Promise<unknown>) => {
      const eventSnapshot = storedEvent ? { ...storedEvent } : null;
      const auditSnapshot = auditRows;
      try {
        return await callback(mocks.tx);
      } catch (error) {
        storedEvent = eventSnapshot;
        auditRows = auditSnapshot;
        throw error;
      }
    },
  );
}

describe('event administrator decisions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedEvent = eventRecord();
    auditRows = 0;
    failAudit = false;
    installStatefulTransaction();
  });

  it('creates an administrator event and its audit in one transaction', async () => {
    storedEvent = null;

    await expect(
      createEvent(
        'admin-1',
        {
          title: 'New Rider meetup',
          description: 'Meet, learn and connect with other Riders in Accra.',
          date: '2099-11-01T10:00:00.000Z',
        },
        auditContext,
      ),
    ).resolves.toMatchObject({ id: 'event-created', title: 'New Rider meetup' });

    expect(auditRows).toBe(1);
    expect(mocks.recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'RIDER_EVENT_CREATED',
        entityType: 'Event',
        entityId: 'event-created',
      }),
      mocks.tx,
    );
  });

  it('rolls an administrator update back when audit attribution fails', async () => {
    failAudit = true;

    await expect(
      updateEvent('event-1', 'admin-1', true, { status: 'CANCELLED' }, auditContext),
    ).rejects.toThrow('audit unavailable');

    expect(storedEvent?.status).toBe('UPCOMING');
    expect(auditRows).toBe(0);
  });

  it('rejects a stale competing status transition before audit', async () => {
    mocks.tx.event.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateEvent('event-1', 'admin-1', true, { status: 'CANCELLED' }, auditContext),
    ).rejects.toMatchObject({ statusCode: 409, code: 'EVENT_CHANGED' });

    expect(mocks.recordAudit).not.toHaveBeenCalled();
    expect(storedEvent?.status).toBe('UPCOMING');
  });

  it('validates a partial end-date edit against the persisted start date', async () => {
    await expect(
      updateEvent('event-1', 'admin-1', true, {
        endDate: '2099-10-01T09:00:00.000Z',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.tx.event.updateMany).not.toHaveBeenCalled();
  });

  it('validates a partial start-date edit against the persisted end date', async () => {
    await expect(
      updateEvent('event-1', 'admin-1', true, {
        date: '2099-10-01T13:00:00.000Z',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(mocks.tx.event.updateMany).not.toHaveBeenCalled();
  });
});

describe('Rider event audience and RSVP state', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps historical events out of the administrator operational queue', async () => {
    mocks.prisma.event.findMany.mockResolvedValue([]);
    mocks.prisma.event.count.mockResolvedValue(0);

    await listEvents({
      page: 1,
      limit: 50,
      viewerUserId: 'admin-user-1',
      operationalOnly: true,
    });

    expect(mocks.prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ status: 'ONGOING' }, { status: 'UPCOMING', date: { gte: expect.any(Date) } }],
        },
        orderBy: [{ status: 'desc' }, { date: 'asc' }],
      }),
    );
    expect(mocks.prisma.event.count).toHaveBeenCalledWith({
      where: {
        OR: [{ status: 'ONGOING' }, { status: 'UPCOMING', date: { gte: expect.any(Date) } }],
      },
    });
  });

  it('ignores a Rider-supplied zone and returns global/current-zone events with RSVP state', async () => {
    mocks.prisma.riderProfile.findUnique.mockResolvedValue({ currentZoneId: 'zone-accra' });
    mocks.prisma.event.findMany.mockResolvedValue([
      {
        ...eventRecord(),
        id: 'global-event',
        zoneId: null,
        rsvps: [{ id: 'rsvp-1' }],
        _count: { rsvps: 1 },
      },
      {
        ...eventRecord(),
        id: 'accra-event',
        rsvps: [],
        _count: { rsvps: 0 },
      },
    ]);
    mocks.prisma.event.count.mockResolvedValue(2);

    const result = await listEvents({
      status: 'UPCOMING',
      zoneId: 'zone-kumasi',
      page: 1,
      limit: 20,
      viewerUserId: 'rider-user-1',
      deriveRiderZone: true,
    });

    expect(mocks.prisma.riderProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'rider-user-1' },
      select: { currentZoneId: true },
    });
    expect(mocks.prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'UPCOMING',
          OR: [{ zoneId: null }, { zoneId: 'zone-accra' }],
        },
        include: expect.objectContaining({
          rsvps: {
            where: { userId: 'rider-user-1' },
            select: { id: true },
            take: 1,
          },
        }),
      }),
    );
    expect(result.events).toEqual([
      expect.objectContaining({ id: 'global-event', hasRsvp: true }),
      expect.objectContaining({ id: 'accra-event', hasRsvp: false }),
    ]);
    expect(result.events[0]).not.toHaveProperty('rsvps');
  });
});
