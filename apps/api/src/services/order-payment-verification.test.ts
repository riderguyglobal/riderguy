import { describe, expect, it } from 'vitest';
import { getOrderPaymentReceiptMismatch } from './order-payment-verification';

const order = { totalPrice: 50, currency: 'GHS' };

describe('getOrderPaymentReceiptMismatch', () => {
  it('accepts the exact provider amount and currency', () => {
    expect(
      getOrderPaymentReceiptMismatch(order, { amount: 5000, currency: 'GHS' }),
    ).toBeNull();
  });

  it('rejects an underpayment', () => {
    expect(
      getOrderPaymentReceiptMismatch(order, { amount: 4999, currency: 'GHS' }),
    ).toMatchObject({ code: 'AMOUNT_MISMATCH', expected: 5000, received: 4999 });
  });

  it('rejects a different or missing currency', () => {
    expect(
      getOrderPaymentReceiptMismatch(order, { amount: 5000, currency: 'NGN' }),
    ).toMatchObject({ code: 'CURRENCY_MISMATCH', expected: 'GHS', received: 'NGN' });
    expect(
      getOrderPaymentReceiptMismatch(order, { amount: 5000, currency: undefined }),
    ).toMatchObject({ code: 'CURRENCY_MISMATCH' });
  });
});
