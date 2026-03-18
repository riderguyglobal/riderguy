// ============================================================
// EmailService — SendGrid transactional email service
//
// Provides templated emails for all key user flows:
//   - Welcome (post-registration)
//   - Order confirmation (client)
//   - Delivery receipt (client)
//   - Rider approval / rejection
//   - Payout confirmation (rider)
//   - Password reset OTP
//   - Contact form acknowledgement
//
// All methods are fire-and-forget safe — they log errors
// but never throw to avoid breaking the calling flow.
// ============================================================

import { config } from '../config';
import { logger } from '../lib/logger';

// --------------- types ------------------------------------------------

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// --------------- HTML escaping helper ----------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --------------- lazy-loaded SendGrid ---------------------------------

let sgMail: any = null;

async function getSendGrid(): Promise<any> {
  if (sgMail) return sgMail;
  if (!config.sendgrid.apiKey) {
    logger.warn('SendGrid API key not configured — emails disabled');
    return null;
  }
  try {
    const mod = await import('@sendgrid/mail');
    sgMail = mod.default ?? mod;
    sgMail.setApiKey(config.sendgrid.apiKey);
    return sgMail;
  } catch (err) {
    logger.error({ err }, 'Failed to load @sendgrid/mail');
    return null;
  }
}

// --------------- base template ----------------------------------------

function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b; }
    .container { max-width: 600px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .logo { text-align: center; margin-bottom: 24px; }
    .logo h1 { font-size: 24px; font-weight: 800; color: #0ea5e9; margin: 0; }
    .logo span { color: #18181b; }
    h2 { font-size: 20px; font-weight: 700; margin: 0 0 16px; }
    p { font-size: 14px; line-height: 1.6; margin: 0 0 12px; color: #3f3f46; }
    .btn { display: inline-block; padding: 12px 28px; background-color: #0ea5e9; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin: 16px 0; }
    .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f4f4f5; font-size: 14px; }
    .info-label { color: #71717a; }
    .info-value { font-weight: 600; color: #18181b; }
    .footer { text-align: center; padding-top: 24px; font-size: 12px; color: #a1a1aa; }
    .highlight { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 12px 16px; border-radius: 0 8px 8px 0; margin: 16px 0; }
    .amount { font-size: 28px; font-weight: 800; color: #16a34a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">
        <h1>Rider<span>Guy</span></h1>
      </div>
      ${body}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} RiderGuy. All rights reserved.</p>
      <p>Accra, Ghana</p>
    </div>
  </div>
</body>
</html>`;
}

// --------------- send helper ------------------------------------------

async function sendMail(options: SendMailOptions): Promise<boolean> {
  const sg = await getSendGrid();
  if (!sg) return false;

  try {
    await sg.send({
      to: options.to,
      from: {
        email: config.sendgrid.fromEmail,
        name: 'RiderGuy',
      },
      subject: options.subject,
      html: options.html,
      text: options.text ?? options.subject,
    });
    logger.info({ to: options.to, subject: options.subject }, 'Email sent');
    return true;
  } catch (err) {
    logger.error({ err, to: options.to, subject: options.subject }, 'Email failed');
    return false;
  }
}

// ============================================================
// Public API — templated emails
// ============================================================

export class EmailService {
  // ---- Welcome email (post-registration) ----
  static async sendWelcome(to: string, firstName: string) {
    const html = baseLayout(
      'Welcome to RiderGuy',
      `
      <h2>Welcome aboard, ${escapeHtml(firstName)}! 🎉</h2>
      <p>Thanks for joining RiderGuy — the fastest delivery platform in town.</p>
      <p>Your account has been created successfully. Here's what you can do next:</p>
      <div class="highlight">
        <p style="margin:0"><strong>Get started:</strong> Open the app, complete your profile, and place your first delivery order or sign up as a rider.</p>
      </div>
      <a href="${process.env.APP_URL ?? 'https://riderguy.com'}" class="btn">Open RiderGuy</a>
      <p>If you have any questions, our support team is always here to help.</p>
    `,
    );
    return sendMail({ to, subject: 'Welcome to RiderGuy! 🚀', html });
  }

  // ---- Order confirmation (client) ----
  static async sendOrderConfirmation(
    to: string,
    data: {
      firstName: string;
      orderNumber: string;
      pickupAddress: string;
      dropoffAddress: string;
      packageType: string;
      totalPrice: number;
      currency: string;
    },
  ) {
    const html = baseLayout(
      'Order Confirmed',
      `
      <h2>Order Confirmed ✓</h2>
      <p>Hi ${escapeHtml(data.firstName)}, your delivery order has been placed successfully.</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td class="info-label" style="padding:8px 0; color:#71717a;">Order #</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">${escapeHtml(data.orderNumber)}</td></tr>
        <tr style="border-top:1px solid #f4f4f5;"><td class="info-label" style="padding:8px 0; color:#71717a;">Package</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">${escapeHtml(data.packageType.replace(/_/g, ' '))}</td></tr>
        <tr style="border-top:1px solid #f4f4f5;"><td class="info-label" style="padding:8px 0; color:#71717a;">Pickup</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">${escapeHtml(data.pickupAddress)}</td></tr>
        <tr style="border-top:1px solid #f4f4f5;"><td class="info-label" style="padding:8px 0; color:#71717a;">Dropoff</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">${escapeHtml(data.dropoffAddress)}</td></tr>
        <tr style="border-top:1px solid #f4f4f5;"><td class="info-label" style="padding:8px 0; color:#71717a;">Total</td><td style="padding:8px 0; text-align:right; font-weight:800; font-size:18px; color:#16a34a;">GH₵${data.totalPrice.toLocaleString()}</td></tr>
      </table>
      <p>We're searching for a rider near you. You'll receive updates as your delivery progresses.</p>
      <a href="${process.env.APP_URL ?? 'https://riderguy.com'}/dashboard/orders" class="btn">Track Order</a>
    `,
    );
    return sendMail({
      to,
      subject: `Order ${data.orderNumber} Confirmed — RiderGuy`,
      html,
    });
  }

  // ---- Delivery receipt (client) ----
  static async sendDeliveryReceipt(
    to: string,
    data: {
      firstName: string;
      orderNumber: string;
      deliveredAt: string;
      riderName: string;
      totalPrice: number;
      tipAmount: number;
      currency: string;
    },
  ) {
    const total = data.totalPrice + data.tipAmount;
    const html = baseLayout(
      'Delivery Complete',
      `
      <h2>Delivery Complete! 🎉</h2>
      <p>Hi ${escapeHtml(data.firstName)}, your package has been delivered successfully.</p>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td class="info-label" style="padding:8px 0; color:#71717a;">Order #</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">${data.orderNumber}</td></tr>
        <tr style="border-top:1px solid #f4f4f5;"><td class="info-label" style="padding:8px 0; color:#71717a;">Delivered</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">${data.deliveredAt}</td></tr>
        <tr style="border-top:1px solid #f4f4f5;"><td class="info-label" style="padding:8px 0; color:#71717a;">Rider</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">${escapeHtml(data.riderName)}</td></tr>
        <tr style="border-top:1px solid #f4f4f5;"><td class="info-label" style="padding:8px 0; color:#71717a;">Delivery Fee</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">GH₵${data.totalPrice.toLocaleString()}</td></tr>
        ${data.tipAmount > 0 ? `<tr style="border-top:1px solid #f4f4f5;"><td class="info-label" style="padding:8px 0; color:#71717a;">Tip</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">GH₵${data.tipAmount.toLocaleString()}</td></tr>` : ''}
        <tr style="border-top:2px solid #e4e4e7;"><td class="info-label" style="padding:8px 0; color:#71717a; font-weight:700;">Total</td><td style="padding:8px 0; text-align:right; font-weight:800; font-size:18px; color:#16a34a;">GH₵${total.toLocaleString()}</td></tr>
      </table>
      <p>Thank you for using RiderGuy! We'd love to hear about your experience.</p>
      <a href="${process.env.APP_URL ?? 'https://riderguy.com'}/dashboard/orders" class="btn">Rate Your Delivery</a>
    `,
    );
    return sendMail({
      to,
      subject: `Delivery Receipt — Order ${data.orderNumber}`,
      html,
    });
  }

  // ---- Rider approval ----
  static async sendRiderApproval(to: string, firstName: string) {
    const html = baseLayout(
      'You\'re Approved!',
      `
      <h2>You're Approved! 🎊</h2>
      <p>Hi ${escapeHtml(firstName)}, great news — your RiderGuy rider application has been approved.</p>
      <div class="highlight">
        <p style="margin:0"><strong>What's next:</strong> Go online in the rider app to start receiving delivery requests and earning money.</p>
      </div>
      <a href="${process.env.APP_URL ?? 'https://rider.riderguy.com'}/dashboard/jobs" class="btn">Go Online Now</a>
      <p>Welcome to the RiderGuy team! 🛵</p>
    `,
    );
    return sendMail({ to, subject: 'Congratulations! Your Rider Account is Approved 🎉', html });
  }

  // ---- Rider rejection ----
  static async sendRiderRejection(to: string, firstName: string, reason?: string) {
    const html = baseLayout(
      'Application Update',
      `
      <h2>Application Update</h2>
      <p>Hi ${escapeHtml(firstName)}, unfortunately your rider application could not be approved at this time.</p>
      ${reason ? `<div class="highlight"><p style="margin:0"><strong>Reason:</strong> ${escapeHtml(reason)}</p></div>` : ''}
      <p>You can update your documents and resubmit your application for another review.</p>
      <a href="${process.env.APP_URL ?? 'https://rider.riderguy.com'}/dashboard/onboarding" class="btn">Update Documents</a>
      <p>If you believe this is an error, please contact our support team.</p>
    `,
    );
    return sendMail({ to, subject: 'Rider Application Update — RiderGuy', html });
  }

  // ---- Payout confirmation (rider) ----
  static async sendPayoutConfirmation(
    to: string,
    data: {
      firstName: string;
      amount: number;
      currency: string;
      destination: string;
      reference: string;
    },
  ) {
    const html = baseLayout(
      'Payout Sent',
      `
      <h2>Payout Sent! 💰</h2>
      <p>Hi ${escapeHtml(data.firstName)}, your withdrawal has been processed successfully.</p>
      <div style="text-align:center; margin:20px 0;">
        <p class="amount" style="font-size:28px; font-weight:800; color:#16a34a; margin:0;">GH₵${data.amount.toLocaleString()}</p>
        <p style="color:#71717a; font-size:13px; margin-top:4px;">sent to ${escapeHtml(data.destination)}</p>
      </div>
      <table style="width:100%; border-collapse:collapse; margin:16px 0;">
        <tr><td class="info-label" style="padding:8px 0; color:#71717a;">Reference</td><td class="info-value" style="padding:8px 0; text-align:right; font-weight:600;">${escapeHtml(data.reference)}</td></tr>
      </table>
      <p>The funds should arrive within 1-3 business days depending on your bank.</p>
      <a href="${process.env.APP_URL ?? 'https://rider.riderguy.com'}/dashboard/wallet" class="btn">View Wallet</a>
    `,
    );
    return sendMail({
      to,
      subject: `Payout of GH₵${data.amount.toLocaleString()} Processed — RiderGuy`,
      html,
    });
  }

  // ---- OTP / Password reset ----
  static async sendOtp(to: string, firstName: string, otp: string, purpose: string = 'verification') {
    const html = baseLayout(
      'Your Verification Code',
      `
      <h2>Your Verification Code</h2>
      <p>Hi ${escapeHtml(firstName)}, here is your one-time code for ${escapeHtml(purpose)}:</p>
      <div style="text-align:center; margin:24px 0;">
        <div style="display:inline-block; background:#f4f4f5; padding:16px 32px; border-radius:12px; letter-spacing:8px; font-size:32px; font-weight:800; color:#18181b;">
          ${escapeHtml(otp)}
        </div>
      </div>
      <p>This code expires in 5 minutes. If you didn't request this code, you can safely ignore this email.</p>
    `,
    );
    return sendMail({ to, subject: 'Your RiderGuy Verification Code', html });
  }

  // ---- Contact form acknowledgement ----
  static async sendContactAck(to: string, firstName: string, subject: string) {
    const html = baseLayout(
      'We Got Your Message',
      `
      <h2>Thanks for Reaching Out! 📬</h2>
      <p>Hi ${escapeHtml(firstName)}, we've received your message regarding "<strong>${escapeHtml(subject)}</strong>".</p>
      <p>Our team will review it and get back to you within 24-48 hours.</p>
      <div class="highlight">
        <p style="margin:0">In the meantime, you can check our <a href="${process.env.APP_URL ?? 'https://riderguy.com'}/faq" style="color:#0ea5e9;">FAQ page</a> for quick answers to common questions.</p>
      </div>
      <p>Thank you for your patience!</p>
    `,
    );
    return sendMail({ to, subject: 'We received your message — RiderGuy', html });
  }

  static async sendContactNotification(data: {
    firstName: string;
    lastName: string;
    email: string;
    subject: string;
    message: string;
  }) {
    const supportEmail = process.env.SUPPORT_EMAIL ?? config.sendgrid.fromEmail;
    const html = baseLayout(
      'New Contact Form Submission',
      `
      <h2>New Contact Form Submission</h2>
      <div class="info-row"><span class="info-label">Name</span><span class="info-value">${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</span></div>
      <div class="info-row"><span class="info-label">Email</span><span class="info-value">${escapeHtml(data.email)}</span></div>
      <div class="info-row"><span class="info-label">Subject</span><span class="info-value">${escapeHtml(data.subject)}</span></div>
      <div class="highlight">
        <p style="margin:0"><strong>Message:</strong></p>
        <p style="margin:8px 0 0;white-space:pre-wrap;">${escapeHtml(data.message)}</p>
      </div>
      <a href="mailto:${escapeHtml(data.email)}" class="btn">Reply to ${escapeHtml(data.firstName)}</a>
    `,
    );
    return sendMail({
      to: supportEmail,
      subject: `[Contact] ${escapeHtml(data.subject)} — ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}`,
      html,
    });
  }
}
