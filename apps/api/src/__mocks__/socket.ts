import { vi } from 'vitest';

const mockRooms = new Map();

export const io = {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
  sockets: {
    adapter: {
      rooms: mockRooms,
    },
  },
};
export const getIO = vi.fn().mockReturnValue(io);
export const initSocketServer = vi.fn().mockReturnValue(io);
export const emitOrderStatusUpdate = vi.fn();
export const emitNewJob = vi.fn();
