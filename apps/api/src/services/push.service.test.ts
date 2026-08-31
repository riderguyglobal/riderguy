import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const pushToken = {
    upsert: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  };
  const session = { findMany: vi.fn() };
  const riderSend = vi.fn();
  const clientSend = vi.fn();
  const config = {
    firebase: {
      rider: {
        projectId: 'rider-project',
        clientEmail: 'rider@example.invalid',
        privateKey: '-----BEGIN PRIVATE KEY-----\nrider\n-----END PRIVATE KEY-----',
      },
      client: {
        projectId: 'client-project',
        clientEmail: 'client@example.invalid',
        privateKey: '-----BEGIN PRIVATE KEY-----\nclient\n-----END PRIVATE KEY-----',
      },
    },
  };
  return {
    pushToken,
    session,
    riderSend,
    clientSend,
    config,
    cert: vi.fn((credentials: unknown) => credentials),
    getApps: vi.fn(() => []),
    initializeApp: vi.fn((_options: unknown, name: string) => ({ name })),
    getMessaging: vi.fn((app: { name: string }) => ({
      sendEachForMulticast: app.name.endsWith('rider') ? riderSend : clientSend,
    })),
  };
});

vi.mock('@riderguy/database', () => ({
  prisma: { pushToken: mocks.pushToken, session: mocks.session },
}));
vi.mock('../config', () => ({ config: mocks.config }));
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('firebase-admin/app', () => ({
  cert: mocks.cert,
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
}));
vi.mock('firebase-admin/messaging', () => ({ getMessaging: mocks.getMessaging }));

describe('PushService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pushToken.updateMany.mockResolvedValue({ count: 0 });
    mocks.session.findMany.mockImplementation(
      ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.map((id) => ({ id }))),
    );
    mocks.config.firebase.rider.projectId = 'rider-project';
    mocks.config.firebase.rider.clientEmail = 'rider@example.invalid';
    mocks.config.firebase.rider.privateKey = '-----BEGIN PRIVATE KEY-----\nrider\n-----END PRIVATE KEY-----';
    mocks.config.firebase.client.projectId = 'client-project';
    mocks.config.firebase.client.clientEmail = 'client@example.invalid';
    mocks.config.firebase.client.privateKey = '-----BEGIN PRIVATE KEY-----\nclient\n-----END PRIVATE KEY-----';
  });

  it('atomically transfers a globally unique token to its current owner and session', async () => {
    const { PushService } = await import('./push.service');
    mocks.pushToken.upsert.mockResolvedValue({ id: 'push-1' });

    await PushService.registerToken(
      'new-user',
      'same-device-token',
      'android',
      'RIDER',
      'session-new',
    );

    expect(mocks.pushToken.upsert).toHaveBeenCalledWith({
      where: { token: 'same-device-token' },
      update: expect.objectContaining({
        userId: 'new-user',
        appProject: 'RIDER',
        deviceId: 'session-new',
        isActive: true,
      }),
      create: expect.objectContaining({
        userId: 'new-user',
        token: 'same-device-token',
        appProject: 'RIDER',
        deviceId: 'session-new',
      }),
    });
  });

  it('routes Rider and Client tokens through separately named Firebase projects', async () => {
    const { PushService } = await import('./push.service');
    mocks.pushToken.findMany.mockResolvedValue([
      { token: 'rider-token', appProject: 'RIDER', deviceId: 'session-rider' },
      { token: 'client-token', appProject: 'CLIENT', deviceId: 'session-client' },
    ]);
    mocks.riderSend.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
    mocks.clientSend.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });

    const result = await PushService.sendToUser('user-1', 'Title', 'Body', { orderId: 'o-1' });

    expect(result).toEqual({ successCount: 2, failureCount: 0 });
    expect(mocks.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'rider-project' }),
      'riderguy-push-rider',
    );
    expect(mocks.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'client-project' }),
      'riderguy-push-client',
    );
    expect(mocks.riderSend).toHaveBeenCalledWith(expect.objectContaining({ tokens: ['rider-token'] }));
    expect(mocks.clientSend).toHaveBeenCalledWith(expect.objectContaining({ tokens: ['client-token'] }));
  });

  it('fails closed and reports every token when project credentials are absent', async () => {
    vi.resetModules();
    mocks.config.firebase.rider.projectId = '';
    const { PushService } = await import('./push.service');
    mocks.pushToken.findMany.mockResolvedValue([
      { token: 'rider-token', appProject: 'RIDER', deviceId: 'session-rider' },
    ]);

    await expect(PushService.sendToUser('user-1', 'Title', 'Body')).resolves.toEqual({
      successCount: 0,
      failureCount: 1,
    });
    expect(mocks.riderSend).not.toHaveBeenCalled();
  });

  it('deactivates invalid registration tokens returned by FCM', async () => {
    vi.resetModules();
    const { PushService } = await import('./push.service');
    mocks.pushToken.findMany.mockResolvedValue([
      { token: 'stale-token', appProject: 'RIDER', deviceId: 'session-rider' },
    ]);
    mocks.riderSend.mockResolvedValue({
      successCount: 0,
      failureCount: 1,
      responses: [{
        success: false,
        error: { code: 'messaging/registration-token-not-registered' },
      }],
    });

    await expect(PushService.sendToUser('user-1', 'Title', 'Body')).resolves.toEqual({
      successCount: 0,
      failureCount: 1,
    });
    expect(mocks.pushToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: { in: ['stale-token'] } },
      data: { isActive: false },
    });
  });

  it('deactivates only tokens bound to a revoked session', async () => {
    const { PushService } = await import('./push.service');

    await PushService.removeSessionTokens('user-1', 'session-1');

    expect(mocks.pushToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', deviceId: 'session-1' },
      data: { isActive: false },
    });
  });

  it('fails closed and deactivates tokens whose registering session expired', async () => {
    vi.resetModules();
    const { PushService } = await import('./push.service');
    mocks.pushToken.findMany.mockResolvedValue([
      { token: 'orphan-token', appProject: 'CLIENT', deviceId: 'expired-session' },
    ]);
    mocks.session.findMany.mockResolvedValue([]);

    await expect(PushService.sendToUser('user-1', 'Title', 'Body')).resolves.toEqual({
      successCount: 0,
      failureCount: 0,
    });
    expect(mocks.pushToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: { in: ['orphan-token'] } },
      data: { isActive: false },
    });
    expect(mocks.clientSend).not.toHaveBeenCalled();
  });
});
