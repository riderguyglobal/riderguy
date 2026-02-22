import { z } from 'zod';
import { currencyAmountSchema } from './common';

export const requestWithdrawalSchema = z.object({
  amount: currencyAmountSchema,
  method: z.enum(['BANK_TRANSFER', 'MOBILE_MONEY']),
  destination: z.string().min(1, 'Destination account is required').max(50),
  destinationName: z.string().min(1, 'Account name is required').max(100),
  bankCode: z.string().max(20).optional(),
});

export type RequestWithdrawalInput = z.infer<typeof requestWithdrawalSchema>;
