#!/usr/bin/env node
/**
 * Remove "wallet" phrasing from both store listings (personal dev accounts
 * cannot distribute apps that present financial features; the client balance
 * is closed-loop so "in-app payments" is the accurate description).
 * Defaults to preview-only. Listings are global metadata, so committing needs:
 *   --apply-live-listing --confirm-live-metadata=ALL_RIDERGUY_APPS
 */
const fs = require('fs');
const crypto = require('crypto');

const APPS = [
  { key: 'apps/client-native/play-store-key.json', pkg: 'com.riderguy.client' },
  { key: 'apps/rider-native/play-store-key.json', pkg: 'com.riderguy.rider' },
];
const APPLY_LIVE = process.argv.includes('--apply-live-listing');
const CONFIRM_LIVE = process.argv.includes('--confirm-live-metadata=ALL_RIDERGUY_APPS');
const allowedArgs = new Set(['--apply-live-listing', '--confirm-live-metadata=ALL_RIDERGUY_APPS']);
const unknownArgs = process.argv.slice(2).filter((arg) => !allowedArgs.has(arg));
if (unknownArgs.length || APPLY_LIVE !== CONFIRM_LIVE) {
  console.error(
    'Refusing unsafe invocation. Preview with no flags. To change GLOBAL metadata for both apps, pass exactly: --apply-live-listing --confirm-live-metadata=ALL_RIDERGUY_APPS',
  );
  process.exit(2);
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${header}.${claims}.${signature}`,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`token: ${JSON.stringify(body)}`);
  return body.access_token;
}

async function api(token, pkg, method, p, body) {
  const res = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}${p}`,
    {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  if (!res.ok)
    throw new Error(`${method} ${p}: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}

function rewrite(pkg, listing) {
  let { title, shortDescription, fullDescription } = listing;
  if (pkg === 'com.riderguy.client') {
    shortDescription = 'Send packages across the city. Book a rider, track live, pay in-app.';
    fullDescription = fullDescription
      .replace(
        '• Pay securely with your in-app wallet, powered by Paystack.',
        '• Pay securely in-app with mobile money, card, or bank transfer — powered by Paystack.',
      )
      .replace('• Secure in-app payments and wallet.', '• Secure in-app payments.')
      .replace(
        'Track your delivery live on the map, and pay securely from your in-app wallet — no cash needed.',
        'Track your delivery live on the map, and pay securely in-app — no cash needed.',
      )
      .replace(
        'pay securely from your in-app wallet — no cash needed',
        'pay securely in-app — no cash needed',
      );
  } else {
    fullDescription = fullDescription.replace(
      '• Track your earnings, wallet, and withdrawals.',
      '• Track your earnings and cash out to mobile money or bank.',
    );
  }
  return { language: 'en-US', title, shortDescription, fullDescription };
}

(async () => {
  for (const app of APPS) {
    const key = JSON.parse(fs.readFileSync(app.key, 'utf8'));
    const token = await getAccessToken(key);
    const edit = await api(token, app.pkg, 'POST', '/edits');
    const listing = await api(token, app.pkg, 'GET', `/edits/${edit.id}/listings/en-US`);
    const updated = rewrite(app.pkg, listing);
    if (
      updated.fullDescription === listing.fullDescription &&
      updated.shortDescription === listing.shortDescription
    ) {
      console.log(`${app.pkg}: no wallet phrasing found, skipping`);
      await api(token, app.pkg, 'DELETE', `/edits/${edit.id}`).catch(() => {});
      continue;
    }
    if (!APPLY_LIVE) {
      console.log(`${app.pkg}: preview only; listing would change, but no update was committed`);
      await api(token, app.pkg, 'DELETE', `/edits/${edit.id}`).catch(() => {});
      continue;
    }
    await api(token, app.pkg, 'PUT', `/edits/${edit.id}/listings/en-US`, updated);
    try {
      await api(token, app.pkg, 'POST', `/edits/${edit.id}:validate`);
      await api(token, app.pkg, 'POST', `/edits/${edit.id}:commit`);
      console.log(`${app.pkg}: listing updated and committed`);
    } catch (e) {
      if (!e.message.includes('changesNotSentForReview')) throw e;
      await api(token, app.pkg, 'POST', `/edits/${edit.id}:commit?changesNotSentForReview=true`);
      console.log(
        `${app.pkg}: listing committed (NOT sent for review — press "Send for review" in the Console UI)`,
      );
    }
    if (/wallet/i.test(updated.fullDescription)) {
      console.log(`  WARNING: 'wallet' still present somewhere in ${app.pkg} description`);
    }
  }
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
