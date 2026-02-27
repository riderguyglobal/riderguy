import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ─── Hoisted mocks (available inside vi.mock factories) ──────
const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

// ─── Mock config ─────────────────────────────────────────────
vi.mock('../config', () => ({
  config: {
    paystack: {
      secretKey: 'sk_test_fake_secret_key_for_testing',
      publicKey: 'pk_test_fake_public_key_for_testing',
      webhookSecret: '',
    },
  },
}));

// ─── Mock axios ──────────────────────────────────────────────
vi.mock('axios', () => ({
  default: {
    create: vi.fn().mockReturnValue({
      get: mockGet,
      post: mockPost,
    }),
  },
}));

import { PaystackService } from '../services/paystack.service';

describe('PaystackService', () => {
  let service: PaystackService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaystackService();
  });

  // ── initializeTransaction ─────────────────────────────────

  describe('initializeTransaction', () => {
    it('should initialise a transaction and return authorization URL', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: {
            authorization_url: 'https://checkout.paystack.com/abc123',
            access_code: 'access_abc123',
            reference: 'ORD_test_ref',
          },
        },
      });

      const result = await service.initializeTransaction({
        email: 'test@riderguy.com',
        amount: 5000,
        reference: 'ORD_test_ref',
        callbackUrl: 'https://riderguy.com/callback',
        metadata: { orderId: 'order-1' },
        channels: ['card', 'mobile_money'],
      });

      expect(result.authorizationUrl).toBe('https://checkout.paystack.com/abc123');
      expect(result.accessCode).toBe('access_abc123');
      expect(result.reference).toBe('ORD_test_ref');

      expect(mockPost).toHaveBeenCalledWith('/transaction/initialize', {
        email: 'test@riderguy.com',
        amount: 5000,
        reference: 'ORD_test_ref',
        callback_url: 'https://riderguy.com/callback',
        metadata: { orderId: 'order-1' },
        channels: ['card', 'mobile_money'],
      });
    });

    it('should throw on Paystack API failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        service.initializeTransaction({
          email: 'test@riderguy.com',
          amount: 5000,
          reference: 'REF_123',
        }),
      ).rejects.toThrow('Payment initialisation failed');
    });
  });

  // ── verifyTransaction ───────────────────────────────────────

  describe('verifyTransaction', () => {
    it('should verify a successful transaction', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          data: {
            status: 'success',
            amount: 5000,
            currency: 'GHS',
            reference: 'ORD_test_ref',
            channel: 'card',
            paid_at: '2026-02-27T10:00:00.000Z',
            gateway_response: 'Successful',
            metadata: { orderId: 'order-1' },
            authorization: {
              authorization_code: 'AUTH_abc',
              card_type: 'visa',
              last4: '4081',
              exp_month: '12',
              exp_year: '2030',
              bin: '408408',
              bank: 'TEST BANK',
              reusable: true,
            },
          },
        },
      });

      const result = await service.verifyTransaction('ORD_test_ref');

      expect(result.status).toBe('success');
      expect(result.amount).toBe(5000);
      expect(result.currency).toBe('GHS');
      expect(result.channel).toBe('card');
      expect(result.paidAt).toBe('2026-02-27T10:00:00.000Z');
      expect(result.authorization?.last4).toBe('4081');
      expect(result.authorization?.reusable).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/transaction/verify/ORD_test_ref');
    });

    it('should handle transaction without authorization data', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          data: {
            status: 'failed',
            amount: 5000,
            currency: 'GHS',
            reference: 'ORD_fail',
            channel: 'mobile_money',
            paid_at: null,
            gateway_response: 'Declined',
            metadata: {},
            authorization: null,
          },
        },
      });

      const result = await service.verifyTransaction('ORD_fail');
      expect(result.status).toBe('failed');
      expect(result.authorization).toBeUndefined();
    });

    it('should throw on verification failure', async () => {
      mockGet.mockRejectedValueOnce(new Error('timeout'));

      await expect(service.verifyTransaction('ORD_bad')).rejects.toThrow('Payment verification failed');
    });
  });

  // ── chargeAuthorization ───────────────────────────────────

  describe('chargeAuthorization', () => {
    it('should charge a previously-authorized card', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: { status: 'success', reference: 'CHARGE_ref' },
        },
      });

      const result = await service.chargeAuthorization({
        authorizationCode: 'AUTH_abc',
        email: 'test@riderguy.com',
        amount: 2000,
        reference: 'CHARGE_ref',
      });

      expect(result.status).toBe('success');
      expect(result.reference).toBe('CHARGE_ref');
    });
  });

  // ── Transfer / Payout ──────────────────────────────────────

  describe('createTransferRecipient', () => {
    it('should create a transfer recipient', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: {
            recipient_code: 'RCP_abc123',
            name: 'Test Rider',
            type: 'mobile_money',
          },
        },
      });

      const result = await service.createTransferRecipient({
        type: 'mobile_money',
        name: 'Test Rider',
        accountNumber: '0241234567',
        bankCode: 'MTN',
        currency: 'GHS',
      });

      expect(result.recipientCode).toBe('RCP_abc123');
      expect(result.name).toBe('Test Rider');
    });
  });

  describe('initiateTransfer', () => {
    it('should initiate a payout transfer', async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: {
            transfer_code: 'TRF_abc',
            reference: 'PAYOUT_ref',
            status: 'pending',
          },
        },
      });

      const result = await service.initiateTransfer({
        amount: 10000,
        recipientCode: 'RCP_abc123',
        reason: 'Rider payout',
        reference: 'PAYOUT_ref',
      });

      expect(result.transferCode).toBe('TRF_abc');
      expect(result.status).toBe('pending');
    });
  });

  describe('verifyTransfer', () => {
    it('should verify transfer status', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          data: {
            status: 'success',
            amount: 10000,
            reason: 'Rider payout',
            recipient: { recipient_code: 'RCP_abc123' },
          },
        },
      });

      const result = await service.verifyTransfer('PAYOUT_ref');
      expect(result.status).toBe('success');
      expect(result.recipientCode).toBe('RCP_abc123');
    });
  });

  // ── listBanks ──────────────────────────────────────────────

  describe('listBanks', () => {
    it('should return Ghanaian banks', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          data: [
            { name: 'MTN Mobile Money', code: 'MTN', type: 'mobile_money', currency: 'GHS' },
            { name: 'GCB Bank', code: 'GCB', type: 'nuban', currency: 'GHS' },
          ],
        },
      });

      const banks = await service.listBanks();
      expect(banks).toHaveLength(2);
      expect(banks[0].name).toBe('MTN Mobile Money');
      expect(banks[1].code).toBe('GCB');
    });
  });

  // ── resolveAccountNumber ───────────────────────────────────

  describe('resolveAccountNumber', () => {
    it('should resolve bank account details', async () => {
      mockGet.mockResolvedValueOnce({
        data: {
          data: {
            account_number: '0241234567',
            account_name: 'Test User',
            bank_id: 42,
          },
        },
      });

      const result = await service.resolveAccountNumber('0241234567', 'MTN');
      expect(result.accountName).toBe('Test User');
      expect(result.accountNumber).toBe('0241234567');
      expect(result.bankId).toBe(42);
    });

    it('should throw on resolution failure', async () => {
      mockGet.mockRejectedValueOnce(new Error('Bad request'));
      await expect(service.resolveAccountNumber('0000', 'BAD')).rejects.toThrow('Account verification failed');
    });
  });

  // ── Webhook Signature Verification ──────────────────────────

  describe('verifyWebhookSignature', () => {
    it('should verify a valid webhook signature', () => {
      const secretKey = 'sk_test_fake_secret_key_for_testing';
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'REF' } });

      const expectedHash = crypto
        .createHmac('sha512', secretKey)
        .update(payload)
        .digest('hex');

      const isValid = service.verifyWebhookSignature(payload, expectedHash);
      expect(isValid).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const payload = JSON.stringify({ event: 'charge.success' });
      const isValid = service.verifyWebhookSignature(payload, 'invalid_signature_here');
      expect(isValid).toBe(false);
    });

    it('should handle Buffer payloads', () => {
      const secretKey = 'sk_test_fake_secret_key_for_testing';
      const payload = Buffer.from(JSON.stringify({ event: 'charge.success' }));

      const hash = crypto
        .createHmac('sha512', secretKey)
        .update(payload)
        .digest('hex');

      const isValid = service.verifyWebhookSignature(payload, hash);
      expect(isValid).toBe(true);
    });
  });

  // ── generateReference ──────────────────────────────────────

  describe('generateReference', () => {
    it('should generate a reference with default prefix', () => {
      const ref = PaystackService.generateReference();
      expect(ref).toMatch(/^RG_[A-Z0-9]+_[A-Z0-9]+$/);
    });

    it('should generate a reference with custom prefix', () => {
      const ref = PaystackService.generateReference('ORD');
      expect(ref).toMatch(/^ORD_[A-Z0-9]+_[A-Z0-9]+$/);
    });

    it('should generate unique references', () => {
      const refs = new Set(Array.from({ length: 100 }, () => PaystackService.generateReference()));
      expect(refs.size).toBe(100);
    });
  });
});
