// ============================================================
// SmsService — mNotify integration for OTP & transactional SMS
//
// mNotify is a Ghana-first SMS gateway. We use the REST API v1
// endpoint for quick-send messages. The service gracefully
// degrades in development (logs instead of sending) and when
// the API key is not configured.
//
// Docs: https://docs.mnotify.com/
// ============================================================

import { config } from '../config';
import { logger } from '../lib/logger';

const MNOTIFY_BASE_URL = 'https://api.mnotify.com/api';

// --------------- types ------------------------------------------------

interface MNotifySendResponse {
  status: string;    // 'success' | 'error'
  code: string;      // e.g. '2000'
  message: string;   // e.g. 'Message sent successfully'
}

interface SendSmsInput {
  to: string;        // Phone number (e.g. '+233241234567' or '0241234567')
  message: string;   // SMS body (max ~160 chars for 1 segment)
}

// --------------- helpers ----------------------------------------------

/**
 * Normalize phone number to local Ghana format (0XXXXXXXXX)
 * mNotify works best with local format without the + prefix.
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // +233XXXXXXXXX → 0XXXXXXXXX
  if (cleaned.startsWith('+233')) {
    cleaned = '0' + cleaned.slice(4);
  }
  // 233XXXXXXXXX → 0XXXXXXXXX
  if (cleaned.startsWith('233') && cleaned.length === 12) {
    cleaned = '0' + cleaned.slice(3);
  }

  return cleaned;
}

// --------------- service class ----------------------------------------

export class SmsService {
  private static get isConfigured(): boolean {
    return Boolean(config.mnotify.apiKey);
  }

  /**
   * Send an SMS via mNotify quick-send API.
   *
   * POST https://api.mnotify.com/api/sms/quick
   * Query: key=<API_KEY>
   * Body:  { recipient[], sender, message, is_schedule: false, schedule_date: '' }
   */
  static async send(input: SendSmsInput): Promise<boolean> {
    const { to, message } = input;
    const recipient = normalizePhone(to);

    // ── Development / unconfigured — log only ──
    if (!this.isConfigured) {
      logger.info(
        { to: recipient, message, provider: 'mnotify' },
        '[SMS] mNotify not configured — message logged instead of sent',
      );
      return true; // Pretend success so auth flow works in dev
    }

    try {
      const url = `${MNOTIFY_BASE_URL}/sms/quick?key=${config.mnotify.apiKey}`;

      const body = {
        recipient: [recipient],
        sender: config.mnotify.senderId,
        message,
        is_schedule: false,
        schedule_date: '',
      };

      logger.info({ to: recipient, sender: config.mnotify.senderId }, '[SMS] Sending via mNotify');

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as MNotifySendResponse;

      if (data.status === 'success' || data.code === '2000') {
        logger.info({ to: recipient, code: data.code }, '[SMS] Sent successfully');
        return true;
      }

      logger.error(
        { to: recipient, status: data.status, code: data.code, message: data.message },
        '[SMS] mNotify API returned an error',
      );
      return false;
    } catch (err) {
      logger.error({ err, to: recipient }, '[SMS] Failed to send via mNotify');
      return false;
    }
  }

  // ---- Convenience: send OTP SMS (with 1 retry) ----
  static async sendOtp(phone: string, code: string): Promise<boolean> {
    const message = `Your RiderGuy verification code is: ${code}. It expires in 5 minutes. Do not share this code with anyone.\n\n@app.myriderguy.com #${code}`;
    const sent = await this.send({ to: phone, message });
    if (sent) return true;

    // One retry after a brief delay
    logger.info({ phone }, '[SMS] OTP send failed, retrying once...');
    await new Promise((r) => setTimeout(r, 1500));
    return this.send({ to: phone, message });
  }

  // ---- Order status notifications ----
  static async sendOrderUpdate(phone: string, orderNumber: string, statusMessage: string): Promise<boolean> {
    return this.send({
      to: phone,
      message: `RiderGuy Order ${orderNumber}: ${statusMessage}`,
    });
  }

  // ---- Rider assignment notification ----
  static async sendRiderAssigned(phone: string, orderNumber: string, riderName: string): Promise<boolean> {
    return this.send({
      to: phone,
      message: `RiderGuy: ${riderName} has been assigned to your order ${orderNumber}. Track your delivery in the app.`,
    });
  }

  // ---- Delivery completed ----
  static async sendDeliveryComplete(phone: string, orderNumber: string): Promise<boolean> {
    return this.send({
      to: phone,
      message: `RiderGuy: Your delivery ${orderNumber} has been completed successfully. Thank you for using RiderGuy!`,
    });
  }

  // ---- New job available (rider) ----
  static async sendNewJobAvailable(phone: string, pickupAddress: string): Promise<boolean> {
    return this.send({
      to: phone,
      message: `RiderGuy: New delivery available! Pickup at ${pickupAddress}. Open the app to accept.`,
    });
  }

  // ---- Welcome SMS ----
  static async sendWelcome(
    phone: string,
    firstName: string,
    role: 'RIDER' | 'CLIENT' | 'BUSINESS_CLIENT' | 'PARTNER' | 'ADMIN' = 'CLIENT',
  ): Promise<boolean> {
    const isRider = role === 'RIDER';
    const appUrl = isRider
      ? 'https://rider.myriderguy.com'
      : 'https://app.myriderguy.com';
    const roleAction = isRider
      ? 'start earning by delivering packages'
      : 'start sending packages across Ghana';

    const message =
      `Welcome to RiderGuy, ${firstName}! 🎉 ` +
      `Your account is ready. Visit ${appUrl} in your browser to ${roleAction}. ` +
      `RiderGuy is a web app — no app store needed! ` +
      `Tap "Add to Home Screen" in your browser menu to install it like a regular app for quick access.`;

    return this.send({ to: phone, message });
  }
}
