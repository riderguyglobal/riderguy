export interface OrderPaymentExpectation {
  totalPrice: number | string | { toString(): string };
  currency: string;
}

export interface ProviderPaymentReceipt {
  amount: unknown;
  currency: unknown;
}

export type OrderPaymentReceiptMismatch =
  | {
      code: 'AMOUNT_MISMATCH';
      message: string;
      expected: number;
      received: unknown;
    }
  | {
      code: 'CURRENCY_MISMATCH';
      message: string;
      expected: string;
      received: unknown;
    };

/**
 * Validate the immutable provider receipt before changing an order's payment
 * status. A reference lookup alone is not enough: a valid Paystack event must
 * also settle the exact amount and currency recorded on the order.
 */
export function getOrderPaymentReceiptMismatch(
  order: OrderPaymentExpectation,
  receipt: ProviderPaymentReceipt,
): OrderPaymentReceiptMismatch | null {
  const expectedAmount = Math.round(Number(order.totalPrice) * 100);
  const receivedAmount = Number(receipt.amount);

  if (!Number.isSafeInteger(receivedAmount) || receivedAmount !== expectedAmount) {
    return {
      code: 'AMOUNT_MISMATCH',
      message: 'Payment amount does not match order',
      expected: expectedAmount,
      received: receipt.amount,
    };
  }

  const expectedCurrency = String(order.currency).trim().toUpperCase();
  const receivedCurrency = String(receipt.currency ?? '').trim().toUpperCase();
  if (!receivedCurrency || receivedCurrency !== expectedCurrency) {
    return {
      code: 'CURRENCY_MISMATCH',
      message: 'Payment currency does not match order',
      expected: expectedCurrency,
      received: receipt.currency,
    };
  }

  return null;
}
