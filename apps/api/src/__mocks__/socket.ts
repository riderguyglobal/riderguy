import { vi } from 'vitest';

export const io = {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
};
export const getIO = vi.fn().mockReturnValue(io);
