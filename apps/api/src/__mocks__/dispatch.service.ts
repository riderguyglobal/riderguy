import { vi } from 'vitest';

export const assignRider = vi.fn().mockResolvedValue({ id: 'mock-order', status: 'ASSIGNED' });
export const enqueuePayoutJob = vi.fn().mockResolvedValue(undefined);
