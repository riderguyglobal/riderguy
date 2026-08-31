import { describe, expect, it } from 'vitest';
import { requestWithdrawalSchema } from '@riderguy/validators';

describe('requestWithdrawalSchema', () => {
  it('requires a payout provider code', () => {
    const result = requestWithdrawalSchema.safeParse({
      amount: 50,
      method: 'MOBILE_MONEY',
      destination: '0551234567',
      destinationName: 'Ama Rider',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'bankCode')).toBe(true);
    }
  });

  it('rejects placeholder provider codes', () => {
    const result = requestWithdrawalSchema.safeParse({
      amount: 50,
      method: 'BANK_TRANSFER',
      destination: '1234567890',
      destinationName: 'Ama Rider',
      bankCode: 'select',
    });

    expect(result.success).toBe(false);
  });

  it('normalizes an international Ghana Mobile Money number', () => {
    const result = requestWithdrawalSchema.parse({
      amount: 50,
      method: 'MOBILE_MONEY',
      destination: '+233 55 123 4567',
      destinationName: '  Ama Rider  ',
      bankCode: 'MTN',
    });

    expect(result).toMatchObject({
      destination: '0551234567',
      destinationName: 'Ama Rider',
      bankCode: 'MTN',
    });
  });

  it('rejects an invalid Ghana Mobile Money number', () => {
    const result = requestWithdrawalSchema.safeParse({
      amount: 50,
      method: 'MOBILE_MONEY',
      destination: '12345',
      destinationName: 'Ama Rider',
      bankCode: 'MTN',
    });

    expect(result.success).toBe(false);
  });

  it('normalizes a Ghana bank account number', () => {
    const result = requestWithdrawalSchema.parse({
      amount: 100,
      method: 'BANK_TRANSFER',
      destination: '1234-567-890',
      destinationName: 'Ama Rider',
      bankCode: 'GH280100',
    });

    expect(result.destination).toBe('1234567890');
  });
});
