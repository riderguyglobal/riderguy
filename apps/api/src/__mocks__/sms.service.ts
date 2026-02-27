import { vi } from 'vitest';

// Mock SMS service for tests — uses vi.fn() for spying
export const SmsService = {
  sendNewJobAvailable: vi.fn().mockResolvedValue({ success: true }),
  sendOtp: vi.fn().mockResolvedValue({ success: true, messageId: 'mock-msg-1' }),
  sendWelcome: vi.fn().mockResolvedValue({ success: true }),
  sendOrderUpdate: vi.fn().mockResolvedValue({ success: true }),
};
