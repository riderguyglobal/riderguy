import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../lib/logger';

// ============================================================
// Paystack Integration Service — Sprint 6
//
// Handles: card/mobile-money charges, bank transfers,
// recipient management, transfer initiation, webhook
// verification, and bank list retrieval.
// ============================================================

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export class PaystackService {
  private client: AxiosInstance;
  private webhookSecret: string;

  constructor() {
    this.client = axios.create({
      baseURL: PAYSTACK_BASE_URL,
      headers: {
        Authorization: `Bearer ${config.paystack.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    this.webhookSecret = config.paystack.webhookSecret;
  }

  // ── Charge / Payment Collection ──

  /**
   * Initialise a payment transaction (card/mobile money).
   * Returns an authorization URL the client should redirect to.
   */
  async initializeTransaction(params: {
    email: string;
    amount: number; // in pesewas (1 GHS = 100 pesewas)
    reference: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
    channels?: ('card' | 'bank' | 'ussd' | 'mobile_money' | 'bank_transfer')[];
  }): Promise<{
    authorizationUrl: string;
    accessCode: string;
    reference: string;
  }> {
    try {
      const { data } = await this.client.post('/transaction/initialize', {
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
        channels: params.channels,
      });

      return {
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        reference: data.data.reference,
      };
    } catch (err) {
      logger.error({ err }, 'Paystack: Failed to initialise transaction');
      throw new Error('Payment initialisation failed');
    }
  }

  /**
   * Verify a transaction status by reference.
   */
  async verifyTransaction(reference: string): Promise<{
    status: string; // 'success' | 'failed' | 'abandoned'
    amount: number;
    currency: string;
    reference: string;
    channel: string;
    paidAt: string | null;
    gatewayResponse: string;
    metadata: Record<string, unknown>;
    authorization?: {
      authorizationCode: string;
      cardType: string;
      last4: string;
      expMonth: string;
      expYear: string;
      bin: string;
      bank: string;
      reusable: boolean;
    };
  }> {
    try {
      const { data } = await this.client.get(`/transaction/verify/${reference}`);
      const tx = data.data;

      return {
        status: tx.status,
        amount: tx.amount,
        currency: tx.currency,
        reference: tx.reference,
        channel: tx.channel,
        paidAt: tx.paid_at,
        gatewayResponse: tx.gateway_response,
        metadata: tx.metadata ?? {},
        authorization: tx.authorization
          ? {
              authorizationCode: tx.authorization.authorization_code,
              cardType: tx.authorization.card_type,
              last4: tx.authorization.last4,
              expMonth: tx.authorization.exp_month,
              expYear: tx.authorization.exp_year,
              bin: tx.authorization.bin,
              bank: tx.authorization.bank,
              reusable: tx.authorization.reusable,
            }
          : undefined,
      };
    } catch (err) {
      logger.error({ err, reference }, 'Paystack: Failed to verify transaction');
      throw new Error('Payment verification failed');
    }
  }

  /**
   * Charge a previously-authorized card (recurring payment).
   */
  async chargeAuthorization(params: {
    authorizationCode: string;
    email: string;
    amount: number;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ status: string; reference: string }> {
    try {
      const { data } = await this.client.post('/transaction/charge_authorization', {
        authorization_code: params.authorizationCode,
        email: params.email,
        amount: params.amount,
        reference: params.reference,
        metadata: params.metadata,
      });

      return {
        status: data.data.status,
        reference: data.data.reference,
      };
    } catch (err) {
      logger.error({ err }, 'Paystack: Failed to charge authorization');
      throw new Error('Card charge failed');
    }
  }

  // ── Transfers / Payouts ──

  /**
   * Create a transfer recipient (bank account or mobile money).
   * Must be done before initiating a transfer.
   */
  async createTransferRecipient(params: {
    type: 'nuban' | 'mobile_money' | 'basa';
    name: string;
    accountNumber: string;
    bankCode: string;
    currency?: string;
  }): Promise<{
    recipientCode: string;
    name: string;
    type: string;
  }> {
    try {
      const { data } = await this.client.post('/transferrecipient', {
        type: params.type,
        name: params.name,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: params.currency ?? 'GHS',
      });

      return {
        recipientCode: data.data.recipient_code,
        name: data.data.name,
        type: data.data.type,
      };
    } catch (err) {
      logger.error({ err }, 'Paystack: Failed to create transfer recipient');
      throw new Error('Failed to create payout recipient');
    }
  }

  /**
   * Initiate a transfer (payout) to a bank account.
   */
  async initiateTransfer(params: {
    amount: number; // in pesewas
    recipientCode: string;
    reason: string;
    reference: string;
  }): Promise<{
    transferCode: string;
    reference: string;
    status: string;
  }> {
    try {
      const { data } = await this.client.post('/transfer', {
        source: 'balance',
        amount: params.amount,
        recipient: params.recipientCode,
        reason: params.reason,
        reference: params.reference,
      });

      return {
        transferCode: data.data.transfer_code,
        reference: data.data.reference,
        status: data.data.status,
      };
    } catch (err) {
      logger.error({ err }, 'Paystack: Failed to initiate transfer');
      throw new Error('Payout initiation failed');
    }
  }

  /**
   * Verify a transfer status.
   */
  async verifyTransfer(reference: string): Promise<{
    status: string;
    amount: number;
    reason: string;
    recipientCode: string;
  }> {
    try {
      const { data } = await this.client.get(`/transfer/verify/${reference}`);
      return {
        status: data.data.status,
        amount: data.data.amount,
        reason: data.data.reason,
        recipientCode: data.data.recipient?.recipient_code,
      };
    } catch (err) {
      logger.error({ err, reference }, 'Paystack: Failed to verify transfer');
      throw new Error('Transfer verification failed');
    }
  }

  // ── Bank / Account Utils ──

  /**
   * List all Ghanaian banks supported by Paystack.
   */
  async listBanks(params?: { currency?: string; type?: string }): Promise<
    { name: string; code: string; type: string; currency: string }[]
  > {
    try {
      const { data } = await this.client.get('/bank', {
        params: {
          currency: params?.currency ?? 'GHS',
          type: params?.type,
        },
      });

      return data.data.map((bank: Record<string, string>) => ({
        name: bank.name,
        code: bank.code,
        type: bank.type,
        currency: bank.currency,
      }));
    } catch (err) {
      logger.error({ err }, 'Paystack: Failed to list banks');
      throw new Error('Failed to retrieve bank list');
    }
  }

  /**
   * Resolve a bank account number to get the account name.
   */
  async resolveAccountNumber(accountNumber: string, bankCode: string): Promise<{
    accountNumber: string;
    accountName: string;
    bankId: number;
  }> {
    try {
      const { data } = await this.client.get('/bank/resolve', {
        params: {
          account_number: accountNumber,
          bank_code: bankCode,
        },
      });

      return {
        accountNumber: data.data.account_number,
        accountName: data.data.account_name,
        bankId: data.data.bank_id,
      };
    } catch (err) {
      logger.error({ err }, 'Paystack: Failed to resolve account');
      throw new Error('Account verification failed');
    }
  }

  // ── Webhook Verification ──

  /**
   * Verify a Paystack webhook signature.
   * Returns true if the signature is valid.
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
    if (!this.webhookSecret) {
      logger.warn('Paystack webhook secret not configured — skipping verification');
      return false;
    }

    const hash = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Generate a unique payment reference.
   */
  static generateReference(prefix: string = 'RG'): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${timestamp}_${random}`.toUpperCase();
  }
}

export const paystackService = new PaystackService();
