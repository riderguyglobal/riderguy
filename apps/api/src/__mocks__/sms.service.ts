// Mock SMS service for tests
export const SmsService = {
  sendNewJobAvailable: async () => ({ success: true }),
  sendOtp: async () => ({ success: true }),
  sendWelcome: async () => ({ success: true }),
};
