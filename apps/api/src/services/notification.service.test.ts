import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Type helper ──
const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

// ── Mocks ──

vi.mock('@riderguy/database', () => ({
  prisma: {
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    riderProfile: {
      findMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./push.service', () => ({
  PushService: {
    sendToUser: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../socket', () => ({
  getIO: vi.fn().mockReturnValue({ to: vi.fn().mockReturnThis(), emit: vi.fn() }),
  emitNewJob: vi.fn(),
}));

// ── Import AFTER mocks ──
import { NotificationService, notifyNearbyRiders } from './notification.service';
import { prisma } from '@riderguy/database';
import { PushService } from './push.service';

// ============================================================
// NOTIFICATION SERVICE — COMPREHENSIVE SIMULATION TESTS
// ============================================================

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────
  // 1. CREATE NOTIFICATION — in-app + push
  // ────────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create notification in DB and send push via FCM', async () => {
      const notification = {
        id: 'notif-1',
        userId: 'user-1',
        title: 'New delivery assigned',
        body: 'You have been assigned order RG-001',
        type: 'ORDER',
        isRead: false,
        data: { orderId: 'order-1' },
      };
      asMock(prisma.notification.create).mockResolvedValue(notification);

      const result = await NotificationService.create({
        userId: 'user-1',
        title: 'New delivery assigned',
        body: 'You have been assigned order RG-001',
        type: 'ORDER' as any,
        data: { orderId: 'order-1' },
      });

      expect(result.id).toBe('notif-1');
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          title: 'New delivery assigned',
          type: 'ORDER',
        }),
      });

      // Should trigger FCM push (fire-and-forget)
      expect(PushService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        'New delivery assigned',
        'You have been assigned order RG-001',
        expect.objectContaining({ orderId: 'order-1' }),
      );
    });

    it('should handle notification without data', async () => {
      const notification = {
        id: 'notif-2',
        userId: 'user-1',
        title: 'Welcome!',
        body: 'Thanks for joining Riderguy',
        type: 'SYSTEM',
        isRead: false,
        data: null,
      };
      asMock(prisma.notification.create).mockResolvedValue(notification);

      const result = await NotificationService.create({
        userId: 'user-1',
        title: 'Welcome!',
        body: 'Thanks for joining Riderguy',
        type: 'SYSTEM' as any,
      });

      expect(result).toBeDefined();
      expect(PushService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        'Welcome!',
        'Thanks for joining Riderguy',
        undefined,
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // 2. LIST NOTIFICATIONS — pagination + unread count
  // ────────────────────────────────────────────────────────────
  describe('list', () => {
    it('should return paginated notifications with unread count', async () => {
      const notifications = [
        { id: 'n-1', title: 'Order delivered', isRead: true, createdAt: new Date() },
        { id: 'n-2', title: 'New badge!', isRead: false, createdAt: new Date() },
      ];

      asMock(prisma.notification.findMany).mockResolvedValue(notifications);
      asMock(prisma.notification.count)
        .mockResolvedValueOnce(25) // total
        .mockResolvedValueOnce(3); // unread

      const result = await NotificationService.list('user-1', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.unreadCount).toBe(3);
      expect(result.pagination.totalItems).toBe(25);
      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should handle page 2 pagination correctly', async () => {
      asMock(prisma.notification.findMany).mockResolvedValue([]);
      asMock(prisma.notification.count)
        .mockResolvedValueOnce(25)
        .mockResolvedValueOnce(0);

      const result = await NotificationService.list('user-1', 2, 20);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.hasPreviousPage).toBe(true);
      expect(result.pagination.hasNextPage).toBe(false);
    });

    it('should handle empty notifications', async () => {
      asMock(prisma.notification.findMany).mockResolvedValue([]);
      asMock(prisma.notification.count)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await NotificationService.list('user-1');

      expect(result.data).toHaveLength(0);
      expect(result.unreadCount).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 3. MARK READ / MARK ALL READ
  // ────────────────────────────────────────────────────────────
  describe('markRead', () => {
    it('should mark a specific notification as read', async () => {
      asMock(prisma.notification.updateMany).mockResolvedValue({ count: 1 });

      await NotificationService.markRead('notif-1', 'user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'user-1' },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });

    it('should not update notifications belonging to other users', async () => {
      asMock(prisma.notification.updateMany).mockResolvedValue({ count: 0 });

      await NotificationService.markRead('notif-1', 'wrong-user');

      // updateMany with userId filter ensures no cross-user access
      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'wrong-user' },
        data: expect.any(Object),
      });
    });
  });

  describe('markAllRead', () => {
    it('should mark all unread notifications as read', async () => {
      asMock(prisma.notification.updateMany).mockResolvedValue({ count: 5 });

      await NotificationService.markAllRead('user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isRead: false },
        data: { isRead: true, readAt: expect.any(Date) },
      });
    });
  });

  // ────────────────────────────────────────────────────────────
  // 4. NOTIFY ADMINS — new rider application
  // ────────────────────────────────────────────────────────────
  describe('notifyAdminsNewApplication', () => {
    it('should notify all admins of new rider application', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue({
        firstName: 'Kofi',
        lastName: 'Asante',
      });
      asMock(prisma.user.findMany).mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);
      asMock(prisma.notification.create).mockResolvedValue({ id: 'n-1' });

      await NotificationService.notifyAdminsNewApplication('rider-user-1');

      // Should create a notification for each admin
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should silently handle non-existent rider', async () => {
      asMock(prisma.user.findUnique).mockResolvedValue(null);

      await NotificationService.notifyAdminsNewApplication('ghost');

      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────
  // 5. NOTIFY NEARBY RIDERS — new order broadcast
  // ────────────────────────────────────────────────────────────
  describe('notifyNearbyRiders', () => {
    it('should notify online riders in the same zone', async () => {
      const riders = [{ userId: 'rider-1' }, { userId: 'rider-2' }];
      asMock(prisma.riderProfile.findMany).mockResolvedValue(riders);
      asMock(prisma.order.findUnique).mockResolvedValue({
        distanceKm: 5,
        totalPrice: 13,
        packageType: 'SMALL',
        dropoffAddress: 'Legon',
        pickupLatitude: 5.56,
        pickupLongitude: -0.187,
        isMultiStop: false,
        isScheduled: false,
      });
      asMock(prisma.notification.create).mockResolvedValue({ id: 'n-1' });

      await notifyNearbyRiders('order-1', 'RG-001', 'zone-accra', 'Osu Mall');

      // Should notify both riders
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('should fallback to all online riders when no zone-specific riders found', async () => {
      // First call (zone-specific) returns empty
      asMock(prisma.riderProfile.findMany)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ userId: 'rider-1' }]); // fallback all online

      asMock(prisma.order.findUnique).mockResolvedValue({
        distanceKm: 5,
        totalPrice: 13,
        packageType: 'SMALL',
        dropoffAddress: 'Legon',
        pickupLatitude: 5.56,
        pickupLongitude: -0.187,
        isMultiStop: false,
        isScheduled: false,
      });
      asMock(prisma.notification.create).mockResolvedValue({ id: 'n-1' });

      await notifyNearbyRiders('order-1', 'RG-001', 'zone-rural', 'Village');

      // Should still notify the fallback rider
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────
  // 6. DOCUMENT REVIEW NOTIFICATIONS
  // ────────────────────────────────────────────────────────────
  describe('notifyDocumentReview', () => {
    it('should notify rider of approved document', async () => {
      asMock(prisma.notification.create).mockResolvedValue({ id: 'n-1' });

      await NotificationService.notifyDocumentReview('rider-1', 'DRIVERS_LICENSE', 'APPROVED');

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'rider-1',
          title: 'Document Approved',
          body: expect.stringContaining('drivers license'),
        }),
      });
    });

    it('should notify rider of rejected document with reason', async () => {
      asMock(prisma.notification.create).mockResolvedValue({ id: 'n-1' });

      await NotificationService.notifyDocumentReview(
        'rider-1',
        'NATIONAL_ID',
        'REJECTED',
        'Image is blurry',
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Document Rejected',
          body: expect.stringContaining('Image is blurry'),
        }),
      });
    });
  });
});
